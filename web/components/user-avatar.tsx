import { initials } from "@/lib/user";

const SIZES = { small: "size-[34px] text-[13px]", medium: "size-10 text-sm", large: "size-16 text-xl", xlarge: "size-22 text-3xl" };

/** A round picture of the person, or their initials on a soft blue disc when there is no picture. */
export function UserAvatar({
  name,
  imageUrl,
  size = "small",
}: {
  name: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZES;
}) {
  const box = `${SIZES[size]} shrink-0 rounded-full`;
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`${box} object-cover`} />;
  }
  return (
    <span aria-hidden="true" className={`${box} flex items-center justify-center bg-primary-subtle font-semibold text-primary-ink`}>
      {initials(name)}
    </span>
  );
}
