import fs from 'fs';
import path from 'path';
import Image from 'next/image';
import Link from 'next/link';

// Renders one of the plain-markdown files in docs/contracts/ as a styled page. Those files use
// only a small subset of markdown (#/##/### headings, **bold**, "- " bullets, "---" rules, and
// a trailing two-space line break inside a paragraph) - this is not a general markdown parser,
// deliberately, to avoid a dependency for content this simple and fully under our own control.
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-6 space-y-1 text-gray-700">
        {list.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^#{1,3}\s+/.test(line)) flushList();

    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={blocks.length} className="text-lg font-semibold text-gray-900 mt-6 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={blocks.length} className="text-2xl font-bold text-blueox-primary mt-10 mb-3">
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      // The page's own title already shows this; skip the document's leading H1 line.
      continue;
    } else if (line.trim() === '---') {
      flushList();
      blocks.push(<hr key={blocks.length} className="my-6 border-gray-200" />);
    } else if (line.trim().startsWith('- ')) {
      list.push(line.trim().slice(2));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      const endsWithBreak = rawLine.endsWith('  ');
      blocks.push(
        <p
          key={blocks.length}
          className={`text-gray-700 leading-relaxed ${endsWithBreak ? 'mb-0' : 'mb-4'}`}
        >
          {renderInline(line.trim())}
        </p>
      );
    }
  }
  flushList();

  return blocks;
}

export function LegalDocument({ title, filePath }: { title: string; filePath: string }) {
  const markdown = fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-block mb-8">
          <Image src="/assets/logo.png" alt="BlueOx" width={120} height={48} />
        </Link>

        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-8 sm:p-10 shadow-lg">
          <h1 className="text-3xl font-bold text-blueox-primary mb-6">{title}</h1>
          {renderMarkdown(markdown)}
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          <Link href="/" className="hover:text-blueox-primary">
            &larr; Back to BlueOx
          </Link>
        </p>
      </div>
    </div>
  );
}
