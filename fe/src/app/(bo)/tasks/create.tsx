import { useLocalSearchParams } from 'expo-router';
import { CreateTaskWizard } from '@/components/tasks/CreateTaskWizard';

export default function BOTaskCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <CreateTaskWizard route="bo" taskId={id} />;
}