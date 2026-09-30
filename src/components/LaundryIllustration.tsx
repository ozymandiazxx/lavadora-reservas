import { Leaf, Shirt, ShoppingBasket, Sparkles, WashingMachine } from 'lucide-react'

/** Ilustración amigable armada con íconos + formas, sin depender de assets externos. */
export function LaundryIllustration() {
  return (
    <div className="relative mx-auto flex h-44 w-full max-w-xs items-center justify-center">
      <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-teal-100 via-emerald-50 to-amber-50" />
      <Leaf className="absolute top-6 left-6 size-6 -rotate-[20deg] text-emerald-400" strokeWidth={2} />
      <Sparkles className="absolute top-5 right-8 size-5 text-amber-400" strokeWidth={2} />
      <div className="relative flex size-24 items-center justify-center rounded-3xl bg-white shadow-lg shadow-teal-900/10">
        <WashingMachine className="size-12 text-teal-600" strokeWidth={1.6} />
      </div>
      <Shirt className="absolute bottom-7 left-10 size-7 -rotate-12 text-teal-500" strokeWidth={1.8} />
      <ShoppingBasket className="absolute right-9 bottom-5 size-8 text-amber-600" strokeWidth={1.8} />
    </div>
  )
}
