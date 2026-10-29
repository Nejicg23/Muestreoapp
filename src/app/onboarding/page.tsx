import { redirect } from 'next/navigation';
import { getCurrentUser, listAllUsers } from '@/lib/auth';
import OnboardingClient from './OnboardingClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Asistente de Inicialización (Onboarding) | StockSync Pro',
  description: 'Configuración inicial de roles y carga de base de datos maestra o temporal.',
};

export default async function OnboardingPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login?returnUrl=/onboarding');
  }

  const existingUsers = await listAllUsers();

  return (
    <OnboardingClient
      currentUser={currentUser}
      existingUsers={existingUsers}
    />
  );
}
