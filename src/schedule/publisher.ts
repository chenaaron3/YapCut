import type { PlatformId } from "~/domain/schedule";

/** Opaque media the Publisher can fetch — never a local filesystem path. */
export type PublishMedia = {
  url: string;
  contentType: string;
};

export type PublishJob = {
  platform: PlatformId;
  title: string;
  publishAt: Date;
  video: PublishMedia;
  cover: PublishMedia;
};

export type PublishResult = {
  url: string;
};

/**
 * Hot-swappable upload port (see docs/adr/0001-publisher-port.md).
 * Orchestration stays outside; adapters may download URLs to temp files internally.
 */
export type Publisher = {
  id: PlatformId;
  publish(job: PublishJob): Promise<PublishResult>;
};
