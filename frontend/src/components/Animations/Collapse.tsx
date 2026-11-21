import { useEffect, useState, type ReactNode } from "react";

/**
 * Animated expand/collapse (height + opacity) using the CSS grid `0fr -> 1fr` trick.
 * Content stays mounted; when closed it is `inert` so it can't be focused or read.
 * Overflow is released once the opening transition ends so focus rings aren't clipped.
 */
export function Collapse({
  open,
  id,
  className,
  children,
}: {
  open: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const [settled, setSettled] = useState(open);

  useEffect(() => {
    if (!open) setSettled(false);
  }, [open]);

  return (
    <div
      id={id}
      inert={!open}
      aria-hidden={!open}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && open) setSettled(true);
      }}
      className={[
        "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className ?? "",
      ].join(" ")}
    >
      <div
        className={
          open && settled ? "min-h-0 overflow-visible" : "min-h-0 overflow-hidden"
        }
      >
        {children}
      </div>
    </div>
  );
}
