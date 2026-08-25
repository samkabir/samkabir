import Link from 'next/link';
import { useRouter } from 'next/router';
import { Box } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import PostEditor from '@/components/admin/PostEditor';
import { ErrorState, LoadingRows } from '@/components/admin/States';
import { useResource, useSingleton } from '@/components/admin/useResource';
import { withAdminPage } from '@/lib/adminPage';
import { HINT } from '@/lib/adminTheme';

/**
 * `/admin/blogs/[id]` — edit one post.
 *
 * Two independent loads: the post, and the tag list to choose from. `useSingleton`
 * fetches the post through the same `GET /api/admin/blog/[id]` the API exposes, so
 * it arrives with its cover, share image and tag joins already included — the exact
 * shape `PostEditor` seeds from. A missing or deleted post comes back as a 404,
 * which surfaces here as the error state rather than an empty editor that would
 * silently create a new post on save.
 *
 * The post is not loaded in `getServerSideProps`. The dashboard's convention is
 * that screens fetch their data after they mount — the guard proves the session,
 * the screen fetches through the same authenticated client every other screen
 * uses — and putting the row in props would render it into the page source for no
 * gain.
 */
function EditPostScreen({ adminUser }) {
  const router = useRouter();
  const { id } = router.query;

  const post = useSingleton(id ? `/api/admin/blog/${id}` : null);
  const tags = useResource('/api/admin/tags', { query: { take: 200 } });

  const loading = post.loading || tags.loading;
  const error = post.error || tags.error;

  return (
    <AdminLayout
      title="Edit post"
      number="20."
      user={adminUser}
      hint="Changes go live within a minute of publishing."
    >
      <Box className="pb-4">
        <Link href="/admin/blogs" className={HINT}>
          ← back to all posts
        </Link>
      </Box>

      {loading ? (
        <LoadingRows rows={4} label="Loading the post…" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            post.reload();
            tags.reload();
          }}
        />
      ) : post.item ? (
        <PostEditor post={post.item} tags={tags.items} mode="update" />
      ) : (
        <ErrorState message="That post could not be found." />
      )}
    </AdminLayout>
  );
}

/**
 * Wrapped so the theme and toast providers sit *above* the screen — the same
 * arrangement every dashboard page uses. See the note on `adminScreen`.
 */
export default adminScreen(EditPostScreen);

export const getServerSideProps = withAdminPage();
