export function LaundryIllustration() {
  return (
    <div className="relative mx-auto flex h-48 w-full max-w-xs items-center justify-center">
      <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-teal-100 via-emerald-50 to-amber-50" />
      <img
        src="/illustrations/washer-plant.webp"
        alt=""
        className="relative h-40 w-auto drop-shadow-lg"
        width={640}
        height={640}
      />
    </div>
  )
}
