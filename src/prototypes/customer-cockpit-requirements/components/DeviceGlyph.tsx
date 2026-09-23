/**
 * 设备示意图标：统一使用线框示意图，避免用真实照片冒充现场设备。
 * 所有图形均为示意，不代表真实型号外观。
 */
import React from 'react';

export type DeviceKind = 'wok' | 'arm' | 'oven' | 'container' | 'rack';

export const DEVICE_LABEL: Record<DeviceKind, string> = {
    wok: '炒菜机',
    arm: '机械臂',
    oven: '烤箱',
    container: '容器',
    rack: '层架',
};

export function DeviceGlyph({ kind, className }: { kind: DeviceKind; className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 120 120"
            role="img"
            aria-label={`${DEVICE_LABEL[kind]}示意图`}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {kind === 'oven' && (
                <>
                    <rect x="20" y="24" width="80" height="72" rx="9" />
                    <rect x="30" y="46" width="60" height="40" rx="4" />
                    <line x1="66" y1="66" x2="86" y2="66" />
                    <circle cx="34" cy="35" r="3.5" />
                    <circle cx="46" cy="35" r="3.5" />
                    <line x1="60" y1="35" x2="88" y2="35" />
                </>
            )}
            {kind === 'wok' && (
                <>
                    <path d="M24 56 Q60 94 96 56 Z" />
                    <line x1="96" y1="56" x2="110" y2="48" />
                    <rect x="28" y="88" width="64" height="14" rx="4" />
                    <path d="M46 44 Q54 34 62 44" />
                    <path d="M64 44 Q72 34 80 44" />
                </>
            )}
            {kind === 'arm' && (
                <>
                    <rect x="42" y="96" width="36" height="12" rx="4" />
                    <line x1="60" y1="96" x2="60" y2="66" />
                    <circle cx="60" cy="66" r="6" />
                    <line x1="60" y1="66" x2="88" y2="46" />
                    <circle cx="88" cy="46" r="5" />
                    <line x1="88" y1="46" x2="102" y2="32" />
                    <path d="M102 32 L112 24" />
                    <path d="M102 32 L112 40" />
                </>
            )}
            {kind === 'container' && (
                <>
                    <path d="M32 44 L88 44 L80 100 L40 100 Z" />
                    <line x1="27" y1="44" x2="93" y2="44" />
                    <line x1="33" y1="62" x2="87" y2="62" />
                </>
            )}
            {kind === 'rack' && (
                <>
                    <rect x="24" y="22" width="72" height="78" rx="6" />
                    <line x1="24" y1="48" x2="96" y2="48" />
                    <line x1="24" y1="74" x2="96" y2="74" />
                    <rect x="34" y="30" width="16" height="13" rx="2" />
                    <rect x="60" y="32" width="22" height="11" rx="2" />
                    <rect x="34" y="56" width="22" height="13" rx="2" />
                    <rect x="64" y="58" width="18" height="11" rx="2" />
                </>
            )}
        </svg>
    );
}
