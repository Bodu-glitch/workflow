import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private from: string;
  private frontendUrl: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.from = this.config.get<string>('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
    this.frontendUrl = this.config.get<string>('APP_FRONTEND_URL', 'http://localhost:3001');
  }

  async sendInvitationEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/accept-invitation?token=${token}`;
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Loi moi tham gia he thong',
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<p>Ban da duoc moi tham gia he thong quan ly cong viec.</p>
<p>Nhan vao lien ket ben duoi va dang nhap bang Google de chap nhan loi moi:</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#1E40AF;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Chap nhan loi moi</a></p>
<p>Hoac copy link: <a href="${link}">${link}</a></p>
<p>Lien ket co hieu luc trong 24 gio.</p>
</body></html>`,
      });
    } catch (err) {
      console.error('[EmailService] Failed to send invitation email:', err);
    }
  }

  async sendInvitationAcceptEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/accept-invitation?token=${token}`;
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Loi moi tham gia workspace moi',
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<p>Ban duoc moi tham gia mot workspace moi.</p>
<p>Nhan vao lien ket ben duoi de xac nhan:</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#1E40AF;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Chap nhan loi moi</a></p>
<p>Hoac accept truc tiep trong ung dung. Link co hieu luc 24 gio.</p>
</body></html>`,
      });
    } catch (err) {
      console.error('[EmailService] Failed to send invitation accept email:', err);
    }
  }
}
