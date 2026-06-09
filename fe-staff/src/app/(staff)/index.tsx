import { Redirect } from 'expo-router';

/** Redirect root staff route → Jobs (Dịch vụ) tab */
export default function StaffIndex() {
  return <Redirect href="/(staff)/jobs" />;
}
