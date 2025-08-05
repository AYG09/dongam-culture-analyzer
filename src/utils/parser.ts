import { v4 as uuidv4 } from 'uuid';
import type { NoteData, ConnectionData, PerceptionIntensity } from '../types/culture';

const layerNameToIndex: { [key: string]: number } = {
    '결과': 0,
    '행동': 1,
    '유형_레버': 2,
    '유형': 2, // Alias
    '무형_레버': 3,
    '무형': 3, // Alias
};

// 인식 강도(PerceptionIntensity) 추출 함수
const extractPerceptionIntensity = (type: string): PerceptionIntensity => {
    if (type.includes('/집중')) return '집중';
    if (type.includes('/관심')) return '관심';
    // 태그 없는 경우 '언급'으로 처리
    return '언급';
};


// 타입 정규화 함수 (인식강도 suffix 처리 포함)
const normalizeType = (type: string): string => {
    // 인식강도 suffix 제거 (신 형식: /집중, /관심, /언급)
    const typeWithoutIntensity = type.split('/')[0];
    const trimmedType = typeWithoutIntensity.trim();
    
    if (trimmedType === '유형') return '유형_레버';
    if (trimmedType === '무형') return '무형_레버';
    return trimmedType;
};

export const parseAIOutput = (text: string): { notes: NoteData[], connections: ConnectionData[] } => {
    const lines = text.split('\n').filter(line => line.trim() !== '');

    const notes: NoteData[] = [];
    const connections: ConnectionData[] = [];
    const noteContentToIdMap = new Map<string, string>();
    const pendingConnections: string[] = [];
    
    // 정규식 개선: content와 metadata를 명확히 분리
    const nodeRegex = /^\[(?<type>[^\]]+)\]\s*\((?<sentiment>[^)]+)\)\s*(?<content>.*?)\s*(?:\((?<metadata>(?:근거|분류):.*)\))?$/i;

    // 1차: 모든 노드를 생성 (위치 계산은 나중에)
    lines.forEach((line) => {
        if (line.startsWith('[연결]') || line.startsWith('[간접연결]')) {
            pendingConnections.push(line);
            return;
        }

        const nodeMatch = line.match(nodeRegex);
        
        if (nodeMatch?.groups) {
            const { type, sentiment, content, metadata } = nodeMatch.groups;
            
            // 인식 강도 추출
            const perceptionIntensity = extractPerceptionIntensity(type);
            
            // 인식 강도 suffix 제거 후 레이어 인덱스 찾기
            const normalizedType = normalizeType(type);
            const layerIndex = layerNameToIndex[normalizedType];
            const trimmedContent = content.trim();

            // 메타데이터 파싱 (분류, 근거 추출)
            let category: string | undefined = undefined;
            let basis: string | undefined = undefined;

            if (metadata) {
                const metaParts = metadata.split(/,\s*(?=(?:분류|근거):)/g); // 각 키워드 앞에서만 분리
                const metaMap = new Map<string, string>();
                metaParts.forEach(part => {
                    const [key, ...valueParts] = part.split(':');
                    if (key && valueParts.length > 0) {
                        metaMap.set(key.trim(), valueParts.join(':').trim());
                    }
                });

                category = metaMap.get('분류');
                basis = metaMap.get('근거');
            }

            if (layerIndex === undefined || !trimmedContent) {
                return;
            }
            
            let sentimentValue: 'positive' | 'negative' | 'neutral' = 'neutral';
            if (sentiment?.includes('긍정')) {
                sentimentValue = 'positive';
            } else if (sentiment?.includes('부정')) {
                sentimentValue = 'negative';
            }

            const newNote: NoteData = {
                id: uuidv4(),
                text: trimmedContent,
                position: { x: 0, y: 0 }, // 임시 위치
                width: 200,
                height: 120,
                type: normalizedType as any, // 타입 단언
                sentiment: sentimentValue,
                perceptionIntensity: perceptionIntensity, // 인식 강도 필드 추가
                basis: basis, // 이론적 근거 필드 추가
                layer: (layerIndex + 1) as 1 | 2 | 3 | 4,
                category: category || undefined,
            };

            notes.push(newNote);
            noteContentToIdMap.set(trimmedContent, newNote.id);
        }
    });

    // 2차: 층위별로 위치 계산 -> layout.ts로 이동됨
    
    // 3차: 모든 연결선을 생성합니다.
    pendingConnections.forEach(line => {
        // 정규식 개선: 소스/타겟에서 내용만 정확히 추출
        const connectionRegex = /\[(간접)?연결\]\s*\[(?<sourceType>[^\]]+)\]\s*\((?<sourceSentiment>[^)]+)\)\s*(?<sourceContent>.+?)\s*→\s*\[(?<targetType>[^\]]+)\]\s*\((?<targetSentiment>[^)]+)\)\s*(?<targetContent>.+?)(?:\s*\((?<relationType>직접|간접)\))?$/;
        const connectionMatch = line.match(connectionRegex);

        if (connectionMatch?.groups) {
            const { sourceContent, targetContent, relationType: relationTypeSuffix } = connectionMatch.groups;
            const isIndirectPrefix = line.startsWith('[간접연결]');

            const sourceId = noteContentToIdMap.get(sourceContent.trim());
            const targetId = noteContentToIdMap.get(targetContent.trim());
            
            if (sourceId && targetId) {
                let relationType = 'direct';
                if (isIndirectPrefix || relationTypeSuffix === '간접') {
                    relationType = 'indirect';
                }

                const newConnection: ConnectionData = {
                    id: uuidv4(),
                    sourceId: sourceId,
                    targetId: targetId,
                    isPositive: true, // 연결선 극성은 일단 '긍정'으로 고정
                    relationType: relationType as 'direct' | 'indirect',
                };
                connections.push(newConnection);
            }
        }
    });

    return { notes, connections };
};