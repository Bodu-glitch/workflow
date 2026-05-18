import { useLocalSearchParams } from 'expo-router';
import { CreateTaskWizard } from '@/components/tasks/CreateTaskWizard';

export default function OTTaskCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <CreateTaskWizard route="ot" taskId={id} />;
}