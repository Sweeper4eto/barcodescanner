import Link from "next/link";
import { AuthShell, LoginForm } from "@/components/auth-forms";
import { t } from "@/i18n";

export default function LoginPage() {
  return (
    <AuthShell title={t("auth.login")} subtitle={t("auth.loginSubtitle")}>
      <LoginForm />
      <div className="mt-4 text-center">
        <Link href="/" className="text-sm text-muted">
          {t("common.home")}
        </Link>
      </div>
    </AuthShell>
  );
}
