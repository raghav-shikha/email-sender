"use client";

import { AuthPanel } from "@/components/AuthPanel";
import { ContextPackForm } from "@/components/ContextPackForm";
import { GmailConnectionPanel } from "@/components/GmailConnectionPanel";
import { PushEnableButton } from "@/components/PushEnableButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-black/60">Connect Gmail, enable push, and tune your context pack.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Supabase email/password auth for MVP.</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gmail</CardTitle>
            <CardDescription>Offline access. Refresh token is encrypted at rest by the API.</CardDescription>
          </CardHeader>
          <CardContent>
            <GmailConnectionPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Push Notifications</CardTitle>
            <CardDescription>Subscribe this device to get notified when drafts are ready.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-black/60">iOS requires Add to Home Screen (iOS 16.4+).</div>
              <PushEnableButton />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Context Pack</CardTitle>
            <CardDescription>Guides keyword prefiltering, summaries, and reply drafts.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContextPackForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
