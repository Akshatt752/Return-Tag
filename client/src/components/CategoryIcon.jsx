import { getCategory } from "../utils/categories";

export default function CategoryIcon({ category, className = "size-5", boxClassName = "size-10" }) {
  const { icon: Icon, label } = getCategory(category);
  return (
    <span className={`grid shrink-0 place-items-center rounded-md bg-muted text-ink-2 ${boxClassName}`} title={label}>
      <Icon className={className} aria-hidden="true" />
    </span>
  );
}
