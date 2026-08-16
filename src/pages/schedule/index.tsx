import Link from "next/link";
import { useState } from "react";

import { AppLayout } from "~/components/layout/AppLayout";
import { Button } from "~/components/ui/button";
import { PLATFORM_IDS, type PlatformId } from "~/domain/schedule";
import { requireUser } from "~/server/auth/session";
import { api } from "~/utils/api";

import type { GetServerSideProps } from "next";
import type { Session } from "next-auth";

type Props = {
  session: Session | null;
};

function formatSlot(iso: Date | string) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default function SchedulePage() {
  const utils = api.useUtils();
  const settingsQuery = api.schedule.settings.useQuery();
  const queueQuery = api.schedule.queue.useQuery();

  const [time, setTime] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<PlatformId[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const updateSettings = api.schedule.updateSettings.useMutation({
    onSuccess: async () => {
      setMessage("Settings saved");
      await utils.schedule.settings.invalidate();
    },
    onError: (err) => setMessage(err.message),
  });

  const settings = settingsQuery.data;
  const timeValue = time ?? settings?.time ?? "17:00";
  const timezoneValue = timezone ?? settings?.timezone ?? "America/New_York";
  const platformsValue = platforms ?? settings?.platforms ?? [...PLATFORM_IDS];

  const togglePlatform = (id: PlatformId) => {
    const next = platformsValue.includes(id)
      ? platformsValue.filter((p) => p !== id)
      : [...platformsValue, id];
    setPlatforms(next.length > 0 ? next : platformsValue);
  };

  return (
    <AppLayout
      title="Schedule · Talking Head"
      description="Publish queue and cadence settings."
    >
      <div className="flex flex-col gap-2 pt-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ember-mono text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
            Cadence
          </p>
          <h1 className="ember-display mt-2 text-5xl leading-[.82] sm:text-7xl">
            Schedule
          </h1>
        </div>
        <Link
          href="/projects"
          className="text-sm text-[#432E6F] underline-offset-4 hover:underline"
        >
          ← Projects
        </Link>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#432E6F]">{message}</p>
      ) : null}

      <section className="ember-card-shadow mt-10 space-y-4 rounded-[24px] border-2 border-[#450E16] bg-[#F5F9CE] p-6">
        <h2 className="ember-display text-3xl leading-none">Settings</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="ember-mono text-[10px] tracking-[.14em] text-[#75677F] uppercase">
              Daily time
            </span>
            <input
              className="rounded-[12px] border-2 border-[#450E16] bg-[#F5F9CE] px-3 py-2"
              value={timeValue}
              onChange={(e) => setTime(e.target.value)}
              placeholder="17:00"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="ember-mono text-[10px] tracking-[.14em] text-[#75677F] uppercase">
              Timezone
            </span>
            <input
              className="rounded-[12px] border-2 border-[#450E16] bg-[#F5F9CE] px-3 py-2"
              value={timezoneValue}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {PLATFORM_IDS.map((id) => (
            <label key={id} className="flex items-center gap-2 capitalize">
              <input
                type="checkbox"
                checked={platformsValue.includes(id)}
                onChange={() => togglePlatform(id)}
              />
              {id}
            </label>
          ))}
        </div>
        <Button
          disabled={updateSettings.isPending}
          className="h-auto rounded-[16px] border-2 border-[#450E16] bg-[#FFA102] px-4 py-2.5 text-[#450E16] shadow-[4px_4px_0_#450E16] hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-[#FFA102] hover:shadow-none"
          onClick={() => {
            setMessage(null);
            updateSettings.mutate({
              time: timeValue,
              timezone: timezoneValue,
              platforms: platformsValue,
            });
          }}
        >
          Save settings
        </Button>
      </section>

      <section className="mt-14 space-y-4">
        <h2 className="ember-display text-3xl leading-none">Queue</h2>
        {queueQuery.isLoading ? (
          <p className="text-sm text-[#432E6F]">Loading…</p>
        ) : null}
        {queueQuery.data?.length === 0 ? (
          <p className="text-sm text-[#432E6F]">
            Nothing queued. Export a project, then use Add to schedule.
          </p>
        ) : null}
        <ul className="space-y-4">
          {queueQuery.data?.map((entry) => {
            return (
              <li
                key={entry.id}
                className="rounded-[16px] border-2 border-[#450E16] bg-[#F5F9CE] p-4 shadow-[4px_4px_0_#450E16]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link
                      href={`/projects/${entry.projectId}`}
                      className="ember-display text-xl underline-offset-4 hover:underline"
                    >
                      {entry.project.title ?? "Untitled"}
                    </Link>
                    <p className="ember-mono mt-1 text-[10px] tracking-[.12em] text-[#75677F] uppercase">
                      {formatSlot(entry.scheduledAt)}
                    </p>
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-3 text-xs">
                  {entry.platformPublishes.map((p) => (
                    <li key={p.platform} className="capitalize">
                      <span className="text-[#75677F]">{p.platform}:</span>{" "}
                      {p.status}
                      {p.postUrl ? (
                        <>
                          {" "}
                          <a
                            href={p.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            link
                          </a>
                        </>
                      ) : null}
                      {p.lastError ? (
                        <span className="text-[#BC2D29]"> — {p.lastError}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  requireUser(ctx);
