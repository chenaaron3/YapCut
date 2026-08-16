type Props = {
  title?: string;
};

export function EmberLoading({ title = "Loading" }: Props) {
  return (
    <div className="mx-auto max-w-lg pt-16" role="status" aria-live="polite">
      <p className="ember-display animate-rise text-5xl leading-[.82] sm:text-6xl">
        {title}
      </p>
      <div className="animate-rise-delay mt-8 h-1.5 overflow-hidden rounded-full bg-[#450E16]/15">
        <div className="ember-indeterminate h-full w-2/5 rounded-full bg-[linear-gradient(90deg,#FFA102_0%,#FAD979_45%,#FFA102_100%)]" />
      </div>
    </div>
  );
}
