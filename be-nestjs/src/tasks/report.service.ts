import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { SupabaseService } from '../supabase/supabase.service.js';

interface CurrentUser {
  id: string;
  tenant_id: string;
  role: string;
}

interface ReportData {
  period: 'month' | 'year';
  date: string; // 'YYYY-MM' for month, 'YYYY' for year
  tenantName: string;
  summary: {
    total: number;
    completed: number;
    overdue: number;
    cancelled: number;
    rejected: number;
    inProgress: number;
  };
  breakdown: { label: string; created: number; completed: number; overdue: number }[];
  staffPerformance: { name: string; assigned: number; completed: number; overdue: number; rate: string }[];
}

@Injectable()
export class ReportService {
  constructor(private supabase: SupabaseService) {}

  async getReportData(user: CurrentUser, period: 'month' | 'year', date: string): Promise<ReportData> {
    const now = new Date();

    // Parse date range
    let fromDate: Date;
    let toDate: Date;
    if (period === 'month') {
      const [y, m] = date.split('-').map(Number);
      fromDate = new Date(Date.UTC(y, m - 1, 1));
      toDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); // last day of month
    } else {
      const y = parseInt(date);
      fromDate = new Date(Date.UTC(y, 0, 1));
      toDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    }

    // Query tasks in range
    const { data: tasks } = await this.supabase.db
      .from('tasks')
      .select('id, status, deadline, created_at')
      .eq('tenant_id', user.tenant_id)
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    const taskList = tasks ?? [];

    // Summary
    const summary = {
      total: taskList.length,
      completed: taskList.filter((t: any) => t.status === 'done').length,
      inProgress: taskList.filter((t: any) => t.status === 'in_progress').length,
      cancelled: taskList.filter((t: any) => t.status === 'cancelled').length,
      rejected: taskList.filter((t: any) => t.status === 'rejected').length,
      overdue: taskList.filter((t: any) =>
        t.deadline && new Date(t.deadline) < now && t.status === 'todo'
      ).length,
    };

    // Breakdown by week (month) or month (year)
    const breakdown: ReportData['breakdown'] = [];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (period === 'month') {
      for (let w = 0; w < 4; w++) {
        const wStart = new Date(fromDate);
        wStart.setUTCDate(fromDate.getUTCDate() + w * 7);
        const wEnd = new Date(wStart);
        wEnd.setUTCDate(wStart.getUTCDate() + 6);
        wEnd.setUTCHours(23, 59, 59, 999);

        const wTasks = taskList.filter((t: any) => {
          const d = new Date(t.created_at);
          return d >= wStart && d <= wEnd;
        });

        breakdown.push({
          label: `Week ${w + 1}`,
          created: wTasks.length,
          completed: wTasks.filter((t: any) => t.status === 'done').length,
          overdue: wTasks.filter((t: any) =>
            t.deadline && new Date(t.deadline) < now && t.status === 'todo'
          ).length,
        });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const mDate = new Date(Date.UTC(parseInt(date), m, 1));
        const mStr = `${mDate.getUTCFullYear()}-${String(mDate.getUTCMonth() + 1).padStart(2, '0')}`;
        const mTasks = taskList.filter((t: any) => t.created_at.startsWith(mStr));
        breakdown.push({
          label: MONTHS[m],
          created: mTasks.length,
          completed: mTasks.filter((t: any) => t.status === 'done').length,
          overdue: mTasks.filter((t: any) =>
            t.deadline && new Date(t.deadline) < now && t.status === 'todo'
          ).length,
        });
      }
    }

    // Staff performance
    const taskIds = taskList.map((t: any) => t.id);
    let staffPerformance: ReportData['staffPerformance'] = [];

    if (taskIds.length > 0) {
      const { data: assignments } = await this.supabase.db
        .from('task_assignments')
        .select('user_id, task_id')
        .in('task_id', taskIds);

      const { data: staffUsers } = await this.supabase.db
        .from('user_tenants')
        .select('user_id, users!inner(full_name)')
        .eq('tenant_id', user.tenant_id)
        .eq('role', 'staff');

      const assignmentList = assignments ?? [];
      const staffList = staffUsers ?? [];

      staffPerformance = staffList.map((s: any) => {
        const assignedTaskIds = assignmentList
          .filter((a: any) => a.user_id === s.user_id)
          .map((a: any) => a.task_id);
        const assignedTasks = taskList.filter((t: any) => assignedTaskIds.includes(t.id));
        const completed = assignedTasks.filter((t: any) => t.status === 'done').length;
        const overdue = assignedTasks.filter((t: any) =>
          t.deadline && new Date(t.deadline) < now && t.status === 'todo'
        ).length;
        const rate = assignedTasks.length > 0
          ? `${Math.round((completed / assignedTasks.length) * 100)}%`
          : '—';

        return {
          name: s.users?.full_name ?? 'Unknown',
          assigned: assignedTasks.length,
          completed,
          overdue,
          rate,
        };
      }).filter((s: any) => s.assigned > 0)
        .sort((a: any, b: any) => b.assigned - a.assigned);
    }

    // Tenant name
    const { data: tenant } = await this.supabase.db
      .from('tenants').select('name').eq('id', user.tenant_id).single();

    return {
      period,
      date,
      tenantName: (tenant as any)?.name ?? 'Workspace',
      summary,
      breakdown,
      staffPerformance,
    };
  }

  async generateExcel(data: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Task Management System';

    const periodLabel = data.period === 'month'
      ? `${data.date} Report`
      : `${data.date} Annual Report`;

    // Helper: tô màu đúng số cell theo số cột, không tô ô thừa
    const styleHeader = (row: ExcelJS.Row, colCount: number) => {
      for (let i = 1; i <= colCount; i++) {
        const cell = row.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      }
    };

    // ── Sheet 1: Summary ──────────────────────────────────────────
    const ws1 = wb.addWorksheet('Summary');

    ws1.mergeCells('A1:D1');
    ws1.getCell('A1').value = `${data.tenantName} — ${periodLabel}`;
    ws1.getCell('A1').font = { bold: true, size: 14 };
    ws1.getCell('A1').alignment = { horizontal: 'center' };

    ws1.addRow([]);
    ws1.addRow(['Metric', 'Count']);
    styleHeader(ws1.lastRow!, 2);

    const summaryRows = [
      ['Total Tasks', data.summary.total],
      ['Completed', data.summary.completed],
      ['In Progress', data.summary.inProgress],
      ['Overdue', data.summary.overdue],
      ['Cancelled', data.summary.cancelled],
      ['Rejected', data.summary.rejected],
      ['Completion Rate', data.summary.total > 0
        ? `${Math.round((data.summary.completed / data.summary.total) * 100)}%`
        : '—'],
    ];
    summaryRows.forEach(r => ws1.addRow(r));
    ws1.columns = [{ width: 25 }, { width: 15 }, { width: 10 }, { width: 10 }];

    // ── Sheet 2: Breakdown ────────────────────────────────────────
    const ws2 = wb.addWorksheet(data.period === 'month' ? 'Weekly Breakdown' : 'Monthly Breakdown');
    ws2.addRow(['Period', 'Created', 'Completed', 'Overdue']);
    styleHeader(ws2.lastRow!, 4);
    data.breakdown.forEach(b => ws2.addRow([b.label, b.created, b.completed, b.overdue]));
    ws2.columns = [{ width: 15 }, { width: 12 }, { width: 12 }, { width: 12 }];

    // ── Sheet 3: Staff Performance ────────────────────────────────
    const ws3 = wb.addWorksheet('Staff Performance');
    ws3.addRow(['Staff Name', 'Assigned', 'Completed', 'Overdue', 'Completion Rate']);
    styleHeader(ws3.lastRow!, 5);

    if (data.staffPerformance.length === 0) {
      ws3.addRow(['No staff data for this period']);
    } else {
      data.staffPerformance.forEach(s =>
        ws3.addRow([s.name, s.assigned, s.completed, s.overdue, s.rate])
      );
    }
    ws3.columns = [{ width: 25 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 18 }];

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async generatePDF(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const periodLabel = data.period === 'month'
        ? `Monthly Report — ${data.date}`
        : `Annual Report — ${data.date}`;

      const blue = '#1E40AF';
      const lightGray = '#F8FAFC';
      const darkText = '#1E293B';

      // ── Title ────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill(blue);
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
        .text(data.tenantName, 40, 20);
      doc.fontSize(11).font('Helvetica')
        .text(periodLabel, 40, 45);
      doc.fillColor(darkText);

      let y = 100;

      // ── Summary ──────────────────────────────────────────────────
      doc.fontSize(13).font('Helvetica-Bold').fillColor(blue).text('Summary', 40, y);
      y += 20;

      const completionRate = data.summary.total > 0
        ? `${Math.round((data.summary.completed / data.summary.total) * 100)}%`
        : '—';

      const summaryItems = [
        ['Total Tasks', String(data.summary.total)],
        ['Completed', String(data.summary.completed)],
        ['In Progress', String(data.summary.inProgress)],
        ['Overdue', String(data.summary.overdue)],
        ['Cancelled', String(data.summary.cancelled)],
        ['Completion Rate', completionRate],
      ];

      summaryItems.forEach(([label, val], i) => {
        const rowY = y + i * 22;
        if (i % 2 === 0) doc.rect(40, rowY, 515, 22).fill(lightGray);
        doc.fillColor(darkText).fontSize(10).font('Helvetica').text(label, 50, rowY + 6);
        doc.font('Helvetica-Bold').text(val, 350, rowY + 6);
      });
      y += summaryItems.length * 22 + 20;

      // ── Breakdown ────────────────────────────────────────────────
      doc.fontSize(13).font('Helvetica-Bold').fillColor(blue).text(
        data.period === 'month' ? 'Weekly Breakdown' : 'Monthly Breakdown', 40, y
      );
      y += 20;

      // Table header
      doc.rect(40, y, 515, 22).fill(blue);
      ['Period', 'Created', 'Completed', 'Overdue'].forEach((h, i) => {
        doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
          .text(h, 50 + i * 128, y + 7);
      });
      y += 22;

      data.breakdown.forEach((b, i) => {
        if (i % 2 === 0) doc.rect(40, y, 515, 20).fill(lightGray);
        doc.fillColor(darkText).fontSize(9).font('Helvetica');
        [b.label, String(b.created), String(b.completed), String(b.overdue)].forEach((v, j) => {
          doc.text(v, 50 + j * 128, y + 5);
        });
        y += 20;
      });
      y += 20;

      // ── Staff Performance ────────────────────────────────────────
      if (y > 650) { doc.addPage(); y = 40; }

      doc.fontSize(13).font('Helvetica-Bold').fillColor(blue).text('Staff Performance', 40, y);
      y += 20;

      doc.rect(40, y, 515, 22).fill(blue);
      ['Name', 'Assigned', 'Completed', 'Overdue', 'Rate'].forEach((h, i) => {
        doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
          .text(h, 50 + i * 103, y + 7);
      });
      y += 22;

      if (data.staffPerformance.length === 0) {
        doc.fillColor(darkText).fontSize(9).font('Helvetica').text('No staff data for this period.', 50, y + 5);
      } else {
        data.staffPerformance.forEach((s, i) => {
          if (y > 750) { doc.addPage(); y = 40; }
          if (i % 2 === 0) doc.rect(40, y, 515, 20).fill(lightGray);
          doc.fillColor(darkText).fontSize(9).font('Helvetica');
          [s.name, String(s.assigned), String(s.completed), String(s.overdue), s.rate].forEach((v, j) => {
            doc.text(v, 50 + j * 103, y + 5, { width: 100, ellipsis: true });
          });
          y += 20;
        });
      }

      doc.end();
    });
  }
}