import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Iniciar Sesión | StockSync Pro',
  description: 'Control de acceso al sistema de inventarios y conteo físico.',
};

export default function LoginPage() {
  return <LoginClient />;
}
