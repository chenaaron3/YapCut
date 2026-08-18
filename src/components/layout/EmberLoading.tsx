type Props = {
  title?: string;
};

export function EmberLoading({ title = "Loading" }: Props) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-lg">
        <p className="ember-display animate-rise text-center text-5xl leading-[.82] sm:text-6xl">
          {title}
        </p>
        <div className="animate-rise-delay mt-8 h-1.5 overflow-hidden rounded-full bg-current/15">
          <div className="ember-indeterminate h-full w-2/5 rounded-full bg-[linear-gradient(90deg,#FFA102_0%,#FAD979_45%,#FFA102_100%)]" />
        </div>
      </div>
    </div>
  );
}
