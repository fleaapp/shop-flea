import { useEffect } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  // Sonner pauses dismiss timers while the page/app is hidden, so toasts that
  // were on screen when the app backgrounded can stick around forever after
  // resuming. Clear anything outstanding on hide and on resume.
  useEffect(() => {
    const clearAll = () => toast.dismiss()
    const onVisibility = () => clearAll()
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", clearAll)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", clearAll)
    }
  }, [])


  // Push toasts below the iOS status bar / Dynamic Island. `env(safe-area-inset-top)`
  // resolves to 0 on browsers/devices without a notch, so this is safe everywhere.
  const topOffset = "calc(env(safe-area-inset-top, 0px) + 12px)"

  return (
    <>
      {/* Force the sonner container to stay centered and on-screen,
          overriding any mobile edge-anchoring the library may apply. */}
      <style>{`
        [data-sonner-toaster] {
          --width: min(420px, calc(100vw - 24px)) !important;
          left: 50% !important;
          right: auto !important;
          transform: translateX(-50%) !important;
          --mobile-offset-left: auto !important;
          --mobile-offset-right: auto !important;
        }
        [data-sonner-toaster][data-mobile="true"] {
          left: 50% !important;
          right: auto !important;
          transform: translateX(-50%) !important;
          --mobile-offset-left: auto !important;
          --mobile-offset-right: auto !important;
        }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        position="top-center"
        closeButton
        offset={topOffset}
        mobileOffset={topOffset}
        style={{
          left: "50%",
          right: "auto",
          transform: "translateX(-50%)",
          width: "min(420px, calc(100vw - 24px))",
          maxWidth: "calc(100vw - 24px)",
        }}
        icons={{
          success: <span className="text-base">✅</span>,
          error: <span className="text-base">❌</span>,
          info: <span className="text-base">ℹ️</span>,
          warning: <span className="text-base">⚠️</span>,
          loading: <span className="text-base animate-spin">⏳</span>,
        }}
        toastOptions={{
          duration: 1800,
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:!py-3 group-[.toaster]:!px-4 group-[.toaster]:!min-h-[48px] group-[.toaster]:!w-[calc(100vw-24px)] group-[.toaster]:!max-w-[420px]",
            description: "group-[.toast]:text-muted-foreground group-[.toast]:text-left",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            closeButton:
              "group-[.toast]:!static group-[.toast]:!ml-auto group-[.toast]:!mr-0 group-[.toast]:!mt-0 group-[.toast]:!mb-0 group-[.toast]:!transform-none group-[.toast]:!border-0 group-[.toast]:!bg-transparent group-[.toast]:!text-foreground group-[.toast]:!opacity-70 group-[.toast]:hover:!opacity-100 group-[.toast]:!h-7 group-[.toast]:!w-7 group-[.toast]:flex-shrink-0",
          },
        }}
        {...props}
      />
    </>
  )
}


export { Toaster }
