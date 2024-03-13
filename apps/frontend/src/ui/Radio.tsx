import { forwardRef } from "react";
import { Radio, RadioGroup, useRadioState } from "ariakit/radio";
import { clsx } from "clsx";

export { RadioGroup, useRadioState };

type RadioScale = "base" | "large";

const scaleClassNames: Record<RadioScale, string> = {
  large: "text-lg",
  base: "text-base",
};

export const RadioField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    value: string;
    scale?: RadioScale;
    children: React.ReactNode;
  }
>(({ label, value, children, scale = "base", ...props }, ref) => {
  const scaleClassName = scaleClassNames[scale];
  return (
    <label className="flex items-baseline gap-4 text-left">
      <Radio ref={ref} value={value} className="peer" {...props} />
      <div className="hover:border-on-light peer-checked:border-on border-l px-2">
        <div className={clsx(scaleClassName, "font-semibold")}>{label}</div>
        <p>{children}</p>
      </div>
    </label>
  );
});
