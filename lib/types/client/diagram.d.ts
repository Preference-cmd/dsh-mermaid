import type { ReactNode } from 'react';
/**
 * Render Mermaid source to a React SVG tree.
 * @param source - the bare diagram source, without any fence.
 * @returns the rendered diagram, null while the engine loads, or undefined when
 * the engine rejects the source or returns no SVG (the caller keeps a code
 * fallback).
 */
export declare function useDiagram(source: string): ReactNode | null | undefined;
/**
 * The diagram this card draws itself, with the source as its code fallback.
 * @param props.source - the bare diagram source.
 * @param props.copyLabel - localized copy action of the fallback fence.
 * @param props.copiedLabel - localized copied confirmation of the fallback fence.
 * @returns the drawn diagram, or the fence while the engine loads or fails.
 */
export declare function DiagramView({ source, copyLabel, copiedLabel }: {
    source: string;
    copyLabel: string;
    copiedLabel: string;
}): ReactNode;
