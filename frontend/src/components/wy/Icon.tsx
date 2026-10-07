import { ICON_PATHS, type IconName } from './icons';

interface IconProps {
  name: IconName;
  className?: string;
}

/**
 * Los trazos vienen del prototipo Withyouly v7 (app.js) y se guardan como
 * cadenas para no reescribirlos como JSX uno por uno.
 */
export default function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
