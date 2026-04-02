import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { postLogout } from "../../lib/auth-api.js";
import { Button } from "../ui/Button.js";

export function LogoutButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      disabled={busy}
      type="button"
      variant="ghost"
      onClick={() => {
        setBusy(true);
        void postLogout()
          .catch(() => {})
          .finally(() => {
            navigate("/login", { replace: true });
            setBusy(false);
          });
      }}
    >
      {busy ? "Signing out…" : "Log out"}
    </Button>
  );
}
