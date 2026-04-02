import { useEffect, useState } from "react";

import { AppShell } from "../components/layout/AppShell.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { useAuthSession } from "../contexts/auth-session-context.js";
import { patchAuth, postChangePassword } from "../lib/auth-api.js";

type Tier = "FREE" | "PRO" | "PREMIUM";

export function SettingsPage() {
  const { account, canViewProbe, refreshSession } = useAuthSession();
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [email, setEmail] = useState(account.email);
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setEmail(account.email);
  }, [account]);

  const onSaveProfile = async () => {
    try {
      setMessage("");
      setIsSavingProfile(true);
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      };
      const updated = await patchAuth<{
        success: true;
        data: {
          firstName: string;
          lastName: string;
          email: string;
          tier: Tier;
        };
      }>("/api/v1/users/me", payload);
      setFirstName(updated.data.firstName);
      setLastName(updated.data.lastName);
      setEmail(updated.data.email);
      setMessage("Profile saved.");
      await refreshSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onChangePassword = async () => {
    try {
      setSecurityMessage("");
      if (!currentPassword.trim() || !newPassword.trim()) {
        setSecurityMessage(
          "Enter your current password and a new password (at least 8 characters).",
        );
        return;
      }
      setIsChangingPassword(true);
      await postChangePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setSecurityMessage(
        "Password updated. You can keep working; new session cookies were issued.",
      );
      await refreshSession();
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <AppShell accountTier={account.tier} canViewProbe={canViewProbe}>
      <div className="min-h-full p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <header className="rounded-xl border border-border-base bg-bg-card px-4 py-3">
            <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
            <p className="text-xs text-text-secondary">Manage profile, tier, and security.</p>
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card accentColor="#3b82f6" subtitle="Basic account details" title="Profile">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    disabled={isSavingProfile}
                    label="First name"
                    onChange={(e) => setFirstName(e.target.value)}
                    value={firstName}
                  />
                  <Input
                    disabled={isSavingProfile}
                    label="Last name"
                    onChange={(e) => setLastName(e.target.value)}
                    value={lastName}
                  />
                </div>
                <Input
                  disabled={isSavingProfile}
                  label="Email"
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  value={email}
                />
                <Button disabled={isSavingProfile} onClick={() => void onSaveProfile()}>
                  {isSavingProfile ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </Card>

            <Card
              accentColor="#8b5cf6"
              subtitle="Upgrade controls and usage context"
              title="Subscription"
            >
              <div className="space-y-3 text-sm">
                <p className="text-text-secondary">
                  Current tier:{" "}
                  <span className="font-semibold text-text-primary">{account.tier}</span>
                </p>
                <ul className="space-y-1 text-text-secondary">
                  <li>• Free: No AI queries, 5 MB upload</li>
                  <li>• Pro: 30 AI queries/month, 50 MB upload</li>
                  <li>• Premium: Unlimited AI queries, 200 MB upload</li>
                </ul>
                <Button variant="secondary">Manage subscription</Button>
              </div>
            </Card>
          </div>

          <Card accentColor="#ef4444" subtitle="Password and account protection" title="Security">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                disabled={isChangingPassword}
                label="Current password"
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                value={currentPassword}
              />
              <Input
                disabled={isChangingPassword}
                label="New password"
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                type="password"
                value={newPassword}
              />
              <div className="md:col-span-2">
                <Button
                  className="justify-center"
                  disabled={isChangingPassword}
                  onClick={() => void onChangePassword()}
                  variant="secondary"
                >
                  {isChangingPassword ? "Updating…" : "Change password"}
                </Button>
              </div>
            </div>
            {securityMessage && (
              <p className="mt-3 text-xs text-text-secondary">{securityMessage}</p>
            )}
          </Card>
          {message && <p className="text-xs text-text-secondary">{message}</p>}
        </div>
      </div>
    </AppShell>
  );
}
