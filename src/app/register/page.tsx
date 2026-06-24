import { AuthShell, RegisterForm } from "@/components/auth-forms";
import { t } from "@/i18n";

export default function RegisterPage() {
  return (
    <AuthShell title={t("auth.register")} subtitle={t("auth.registerSubtitle")}>
      <RegisterForm />
    </AuthShell>
  );
}
