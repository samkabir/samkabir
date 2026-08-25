import { Box } from '@mui/material';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

import { linkProps, rehypePlugins, remarkPlugins } from '../../lib/markdown';
import { rubikFont } from '../../lib/fonts';

/**
 * A post's body, rendered from Markdown.
 *
 * **There is no `dangerouslySetInnerHTML` here, and there must never be.**
 * `react-markdown` produces a React element tree, so the browser never parses a
 * string of our HTML — which means the sanitiser in `lib/markdown.js` is the
 * second line of defence rather than the only one. See that file for the full
 * reasoning; the short version is that `rehype-raw` is deliberately absent, so
 * raw HTML in a post is text.
 *
 * Element styling is done through `components` rather than a `.prose` stylesheet.
 * Tailwind's typography plugin would be the usual answer, but it is another
 * dependency for a set of styles that has to match this site's existing palette
 * anyway — and Tailwind here runs with `important: true`, which fights any plugin
 * that expects its own cascade. Mapping each element explicitly is more lines and
 * no surprises.
 */
const components = {
  h2: ({ children }) => (
    <h2 className="text-2xl md:text-3xl font-semibold text-[#d2d2d2] pt-10 pb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl md:text-2xl font-semibold text-[#d2d2d2] pt-8 pb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-lg font-semibold text-[#d2d2d2] pt-6 pb-2">{children}</h4>
  ),

  p: ({ children }) => <p className="text-[#d2d2d2] leading-relaxed pb-4">{children}</p>,

  a: ({ href, children }) => {
    const external = linkProps(href);

    // Internal links go through `next/link` so navigation stays client-side.
    // `linkProps` returning an empty object is what identifies them.
    if (!external.target) {
      return (
        <Link href={href ?? '#'} className="text-[#64ffda] underline hover:text-[#7a61ff] transform transition duration-500">
          {children}
        </Link>
      );
    }

    return (
      <a
        href={href}
        {...external}
        className="text-[#64ffda] underline hover:text-[#7a61ff] transform transition duration-500"
      >
        {children}
      </a>
    );
  },

  ul: ({ children }) => <ul className="list-disc pl-6 pb-4 text-[#d2d2d2]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 pb-4 text-[#d2d2d2]">{children}</ol>,
  li: ({ children }) => <li className="pb-1">{children}</li>,

  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#7a61ff] pl-4 my-6 text-[#d2d2d2] opacity-90">
      {children}
    </blockquote>
  ),

  /**
   * `pre` scrolls rather than wrapping.
   *
   * A code block that soft-wraps is unreadable — an indented line continues at
   * column zero and the structure disappears. `overflow-x-auto` on the block
   * keeps the page itself from scrolling sideways, which is the failure this
   * usually causes on a phone.
   */
  pre: ({ children }) => (
    <pre className="bg-[#141e30] border border-[#d2d2d2]/20 rounded p-4 my-6 overflow-x-auto text-sm">
      {children}
    </pre>
  ),

  code: ({ inline, className, children }) => {
    // Inside a `pre`, `pre`'s own styling applies and a second background would
    // double up. Only a standalone span of code gets the chip treatment.
    if (inline === false) {
      return <code className={`${className ?? ''} font-mono text-[#d2d2d2]`}>{children}</code>;
    }

    return (
      <code className="font-mono text-sm bg-[#141e30] text-[#64ffda] rounded px-1.5 py-0.5">
        {children}
      </code>
    );
  },

  hr: () => <hr className="border-[#d2d2d2]/20 my-10" />,

  /**
   * Tables scroll inside their own container.
   *
   * A wide table is the most common cause of a page that scrolls horizontally on
   * a phone, and the fix has to be on a wrapper — `overflow-x` on the table
   * itself does nothing.
   */
  table: ({ children }) => (
    <Box className="overflow-x-auto my-6">
      <table className="w-full text-left text-[#d2d2d2] text-sm">{children}</table>
    </Box>
  ),
  th: ({ children }) => (
    <th className="border-b-2 border-[#7a61ff] px-3 py-2 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-[#d2d2d2]/15 px-3 py-2">{children}</td>,

  strong: ({ children }) => <strong className="font-semibold text-[#fff]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="opacity-60">{children}</del>,

  /**
   * An image inside a post stays a plain `<img>`.
   *
   * `next/image` needs `remotePatterns` to name the host, and a post can
   * reference an image anywhere — so converting these would either fail the build
   * on an unlisted host or require allowlisting the whole internet to the
   * optimiser. Uploaded covers do go through `next/image`, because those are
   * always on the Blob host. `loading="lazy"` is the part of the benefit that is
   * available without it.
   */
  img: ({ src, alt, title }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ''}
      title={title}
      loading="lazy"
      className="rounded my-6 max-w-full h-auto"
    />
  ),
};

export default function BlogPostBody({ markdown }) {
  return (
    <Box className={rubikFont.className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        // `skipHtml` is redundant with `rehype-raw` being absent, and that is the
        // point: two independent reasons raw HTML cannot render, so removing one
        // by accident does not open the door.
        skipHtml
      >
        {markdown ?? ''}
      </ReactMarkdown>
    </Box>
  );
}
