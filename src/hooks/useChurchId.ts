import { useChurch } from "./ChurchContext";
export function useChurchId() {
  const { church, loading } = useChurch();
  return { churchId: church?.id ?? null, loading };
}
