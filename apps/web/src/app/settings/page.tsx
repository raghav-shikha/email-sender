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
        <p className="text-sm text-black/60">Sign in, connect Gmail, enable push, and tune your context.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Sign in so we can save your inbox state and preferences.</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gmail</CardTitle>
            <CardDescription>Connect Gmail to ingest messages and generate drafts.</CardDescription>
          </CardHeader>
          <CardContent>
            <GmailConnectionPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Push Notifications</CardTitle>
            <CardDescription>Get notified when a new draft is ready.</CardDescription>
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
            <CardTitle>Context</CardTitle>
            <CardDescription>Used for keyword prefiltering, summaries, and reply drafts.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContextPackForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
