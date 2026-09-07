import React, { useEffect, useMemo, useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import type { AnnotationSourceDocument } from '@axhub/annotation';

type RequirementNode = {
  id: string;
  index?: number;
  title?: string;
  pageId?: string | string[];
  annotationText?: string;
  aiPrompt?: string;
  hasMarkdown?: boolean;
  color?: string;
  images?: string[];
};

type IndexedRequirementNode = RequirementNode & { runtimeIndex: number };

type RequirementSource = AnnotationSourceDocument & {
  data?: AnnotationSourceDocument['data'] & { nodes: RequirementNode[] };
  markdownMap?: Record<string, string>;
};

function matchesPage(node: RequirementNode, pageId: string) {
  if (!node.pageId) return true;
  return Array.isArray(node.pageId) ? node.pageId.includes(pageId) : node.pageId === pageId;
}

function RequirementContent({ content }: { content: string }) {
  const blocks = content.trim().split(/\n{2,}/).filter(Boolean).reduce<string[]>((result, block) => {
    if (/^\d+\.\s*/.test(block) && result.length > 0 && /^\d+\.\s*/.test(result[result.length - 1])) {
      result[result.length - 1] += `\n${block}`;
    } else {
      result.push(block);
    }
    return result;
  }, []);
  return <div className="requirement-overview-content">
    {blocks.map((block, blockIndex) => {
      const lines = block.split('\n');
      const heading = lines.length === 1 ? lines[0].match(/^#{1,3}\s+(.+)$/) : null;
      if (heading) return <h4 key={blockIndex}>{heading[1]}</h4>;
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        return <ul key={blockIndex}>{lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^[-*]\s+/, '')}</li>)}</ul>;
      }
      if (lines.every((line) => /^\d+\.\s*/.test(line))) {
        return <ol key={blockIndex}>{lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^\d+\.\s*/, '')}</li>)}</ol>;
      }
      return <p key={blockIndex}>{block}</p>;
    })}
  </div>;
}

export function RequirementOverviewDrawer({
  source,
  currentPageId,
}: {
  source: AnnotationSourceDocument;
  currentPageId: string;
}) {
  const [open, setOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const requirementSource = source as RequirementSource;
  const nodes = useMemo<IndexedRequirementNode[]>(() => requirementSource.data?.nodes
    ?.filter((node) => node.pageId !== '__annotation-index-gap__' && matchesPage(node, currentPageId))
    .map((node, index) => ({ ...node, runtimeIndex: node.index ?? index + 1 })) || [], [currentPageId, requirementSource.data?.nodes]);

  useEffect(() => setOpen(false), [currentPageId]);
  useEffect(() => setPreviewImage(null), [currentPageId]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (nodes.length === 0) return null;

  return <>
    {!open && <button
      type="button"
      className="requirement-overview-trigger"
      aria-expanded="false"
      aria-controls="requirement-overview-drawer"
      onClick={() => setOpen(true)}
    >
      <ListChecks size={18} />
      <span>需求一览</span>
      <strong>{nodes.length}</strong>
    </button>}

    <aside
      id="requirement-overview-drawer"
      className={`requirement-overview-drawer${open ? ' is-open' : ''}`}
      aria-hidden={!open}
      aria-label="当前页面需求标注一览"
    >
      <header>
        <div>
          <span>当前页面</span>
          <h2>需求标注一览</h2>
          <p>共 {nodes.length} 条需求标注</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="隐藏需求标注一览">
          <X size={20} />
        </button>
      </header>
      <div className="requirement-overview-list">
        {nodes.map((node, index) => {
          const content = node.hasMarkdown
            ? requirementSource.markdownMap?.[node.id]
            : node.annotationText;
          return <article key={node.id}>
            <div className="requirement-overview-item-heading">
              <span style={{ backgroundColor: node.color || '#1677ff' }}>{node.runtimeIndex}</span>
              <h3>{node.title || `需求标注 ${index + 1}`}</h3>
            </div>
            <RequirementContent content={(content || node.annotationText || node.aiPrompt || '暂无补充说明').trim()} />
            {node.images?.map((image) => {
              const imageSource = requirementSource.assetMap?.[image] || image;
              return <button type="button" className="requirement-overview-image" key={image} onClick={() => setPreviewImage(imageSource)} aria-label={`放大查看${node.title || '需求标注'}图片`}>
                <img src={imageSource} alt={`${node.title || '需求标注'}附件`} />
                <span>点击放大查看</span>
              </button>;
            })}
          </article>;
        })}
      </div>
    </aside>
    {previewImage && <div className="annotation-image-zoom" role="dialog" aria-modal="true" aria-label="查看需求标注图片" onClick={() => setPreviewImage(null)}><button type="button" className="annotation-image-zoom-close" aria-label="关闭图片预览" onClick={() => setPreviewImage(null)}>×</button><img src={previewImage} alt="需求标注图片" onClick={(event) => event.stopPropagation()} /></div>}
  </>;
}
