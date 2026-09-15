/**
 * The notice on the old site, after the app moves to a new address.
 *
 * Plan batch [4.3] moves the app off GitHub Pages. The data does not move with
 * it: `localStorage` belongs to an origin, so everything the teacher has stays
 * on the old address until she carries it across herself, with the export and
 * import from batch 3.3. This banner is the only thing that tells her so.
 *
 * It is driven by `VITE_MOVED_TO`, read at **build** time. The Pages build sets
 * it and the Vercel build does not, so one source produces a site that says
 * "this has moved" and a site that says nothing — and the new site can never
 * accidentally tell her to move away from itself.
 *
 * `role="status"` rather than `alert`: nothing is broken and nothing is waiting
 * on her this second. The export button is repeated here, rather than pointing
 * at the toolbar, because the sentence asks her to do a thing and the thing
 * should be under the sentence.
 */
export const MovedBanner = ({
  url,
  onExportBackup,
}: {
  url: string;
  onExportBackup: () => void;
}) => (
  <div role="status" className="storage-notice" data-testid="movedBanner">
    <p>
      This app has moved to{" "}
      <a href={url} data-testid="movedBannerLink">
        {url}
      </a>
      . Export your data here and import it there.
    </p>
    <p>
      {/* The old site keeps working for the whole transition window, and saying
          so is the point: a banner that reads like a shutdown notice makes
          people rush a migration they should take carefully. */}
      Your data is still here and this page still works. Nothing is lost if you
      do this later.
    </p>
    <button id="movedBannerExportBtn" type="button" onClick={onExportBackup}>
      Export a backup
    </button>
  </div>
);

/**
 * The address the app has moved to, or `null` when it has not moved.
 *
 * A blank or whitespace-only value counts as not set. A workflow that defines
 * the variable and leaves it empty is the likely accident, and the result of
 * treating that as "moved" would be a banner pointing at nowhere.
 */
export const movedTo = (): string | null => {
  const url = import.meta.env.VITE_MOVED_TO?.trim();
  return url === undefined || url === "" ? null : url;
};
