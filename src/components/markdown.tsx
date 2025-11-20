import { cn } from "@renderer/utils/cn";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AnchorHTMLAttributes } from "react";
import React, { useRef, useMemo } from "react";
import type { Options } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { ChevronDown, Lightbulb } from "lucide-react";

interface ChatMarkdownProps {
  [key: string]: any;
  children: string;
  options?: Options;
}

export const Markdown: React.FC<ChatMarkdownProps> = ({ children, options, ...rest }) => {
  const processedChildren = useMemo(() => {
    const openTags = (children.match(/<think>/g) || []).length;
    const closeTags = (children.match(/<\/think>/g) || []).length;

    const isThinking = openTags > closeTags;

    const newChildren = children + "</think>".repeat(openTags - closeTags);

    return newChildren
      .replace(/<think>\s*/g, `<div class='thinking' data-thinking='${isThinking}'>`)
      .replace(/<\/think>/g, "</div>");
  }, [children]);

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeRaw, remarkGfm]}
      {...options}
      components={
        {
          style: Span,
          script: Span,
          p: Paragraph,
          span: Span,
          pre: Pre,
          code: Code,
          div: Div,
          h6: H6,
          h5: H5,
          h4: H4,
          h3: H3,
          h2: H2,
          h1: H1,
          li: Li,
          ul: UL,
          ol: OL,
          a: Link,
          img: Image,
          strong: Strong,
          hr: HR,
          br: BR,
          ...options?.components,
        } as any
      }
      {...rest}
    >
      {processedChildren}
    </ReactMarkdown>
  );
};

function Strong({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLDivElement>) {
  return (
    <strong className={cn("font-bold text-foreground", className)} {...rest}>
      {children}
    </strong>
  );
}

function Paragraph({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("my-1 break-words whitespace-normal text-[15px]", className)} {...rest}>
      {children}
    </p>
  );
}

function Span({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-base break-words whitespace-pre-wrap", className)} {...rest}>
      {children}
    </span>
  );
}

function Div({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLDivElement>) {
  if (className?.includes("thinking")) {
    const isThinking = (rest as any)["data-thinking"] === "true";
    return <Thinking isThinking={isThinking}>{children}</Thinking>;
  }
  return (
    <div className={cn("break-words whitespace-pre-wrap", className)} {...rest}>
      {children}
    </div>
  );
}

function H6({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLHeadingElement>) {
  return (
    <h6 className={cn("break-words whitespace-pre-wrap text-xs text-foreground/90 my-2", className)} {...rest}>
      {children}
    </h6>
  );
}
function H5({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn("break-words whitespace-pre-wrap text-sm text-foreground/90 my-2", className)} {...rest}>
      {children}
    </h5>
  );
}

function H4({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 className={cn("break-words whitespace-pre-wrap text-sm text-foreground/90 mt-3 mb-2", className)} {...rest}>
      {children}
    </h4>
  );
}

function H3({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("break-words whitespace-pre-wrap text-base text-foreground/90 mt-3 mb-2", className)} {...rest}>
      {children}
    </h3>
  );
}

function H2({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("break-words whitespace-pre-wrap text-base text-foreground/90 mt-3 mb-2", className)} {...rest}>
      {children}
    </h2>
  );
}

function H1({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("break-words whitespace-pre-wrap text-lg text-foreground/90 mt-3 mb-2", className)} {...rest}>
      {children}
    </h2>
  );
}

function HR({ className, ...rest }: React.ParamHTMLAttributes<HTMLHeadingElement>) {
  return <hr className={cn("break-words my-2", className)} {...rest} />;
}

function BR({ className, ...rest }: React.ParamHTMLAttributes<HTMLBRElement>) {
  return <br className={cn("", className)} {...rest} />;
}

function Li({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn("!m-0 marker:text-muted-foreground text-sm", className)} {...rest}>
      {children}
    </li>
  );
}

function Link({ children, href, className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = href?.startsWith("http");

  if (isExternal && href) {
    const openLink = () => {
      console.log("Opening link", href);
      openUrl(href);
    };

    return (
      <div
        onClick={openLink}
        className={cn("text-foreground/90 font-bold hover:underline cursor-pointer inline", className)}
      >
        {children}
      </div>
    );
  }

  return (
    <a
      className={cn("text-foreground/90 font-bold hover:underline cursor-pointer", className)}
      target="_blank"
      rel="noreferrer"
      href={href}
      {...rest}
    >
      {children}
    </a>
  );
}

function Pre({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      className={cn(
        "my-0 bg-background/80 dark:bg-neutral-900 text-foreground/90 text-sm break-words whitespace-pre-wrap p-2 rounded-lg",
        className,
      )}
      {...rest}
    >
      {children}
    </pre>
  );
}

function Code({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLElement>) {
  const codeRef = useRef<HTMLElement>(null);

  return (
    <code
      ref={codeRef}
      className={cn(
        "my-1 bg-background/80 dark:bg-neutral-900 break-words whitespace-pre-wrap text-foreground/90 text-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </code>
  );
}

function Image({ alt, className, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      alt={alt}
      className={cn(
        "h-[200px] w-[250px] object-cover bg-no-repeat object-center my-0 group-hover:scale-[102%] transition",
        className,
      )}
      {...rest}
    />
  );
}

function UL({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn("list-disc list-inside", className)} {...rest}>
      {children}
    </ul>
  );
}

function OL({ children, className, ...rest }: React.ParamHTMLAttributes<HTMLOListElement>) {
  return (
    <ol className={cn("list-decimal list-inside", className)} {...rest}>
      {children}
    </ol>
  );
}

function Thinking({
  children,
  className,
  isThinking = false,
  ...rest
}: React.ParamHTMLAttributes<HTMLDivElement> & { isThinking?: boolean }) {
  return (
    <Collapsible className="w-full my-4">
      <CollapsibleTrigger className="text-muted-foreground group flex items-center gap-2 bg-background-surface-high hover:bg-background-surface-highest dark:bg-background-surface-highlight dark:hover:bg-background-surface-highlight-high border border-border/50 px-3 py-2 text-sm rounded-xl w-full text-left transition-all duration-200 hover:shadow-sm">
        <div className={cn("flex items-center gap-1 text-muted-foreground", isThinking && "animate-pulse")}>
          {isThinking ? <Lightbulb className={cn("size-3.5")} /> : null}
          <span className="font-medium">
            {isThinking ? (
              <>
                Thinking
                <span>
                  <span className="animate-thinking-dots-1 opacity-0">.</span>
                  <span className="animate-thinking-dots-2 opacity-0">.</span>
                  <span className="animate-thinking-dots-3 opacity-0">.</span>
                </span>
              </>
            ) : (
              "Thought process"
            )}
          </span>
        </div>

        <div className="ml-auto transform group-data-[state=open]:rotate-180 transition-transform duration-200 [&>svg]:size-4">
          <ChevronDown />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className={cn(
            "mt-1 p-3 bg-muted/20 border border-border/30 rounded-lg",
            "text-sm text-muted-foreground leading-relaxed",
            "break-words whitespace-pre-wrap",
            "relative overflow-hidden",
            "bg-background-surface-high dark:bg-background-surface-highlight",
            className,
          )}
          {...rest}
        >
          <div className="relative z-10">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
