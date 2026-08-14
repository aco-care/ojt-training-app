// Runs @react-pdf/renderer off the main thread. PDF layout/rendering is
// synchronous, CPU-heavy work; doing it on the main thread blocks the tab
// long enough for the browser's own "page unresponsive" prompt to appear
// on worklists with more than a couple of records. A Worker never blocks
// the UI thread regardless of how long the render takes.
import { pdf, Document } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { TrainingRecordPage } from './training-record-pdf';
import { OjtRecordPage } from './ojt-record-pdf';
import { FinalEvaluationPage } from './final-evaluation-pdf';
import type {
  WorkerInfo,
  TrainingItemData,
  OjtUserData,
  EvaluationData,
} from './pdf-types';

export type PdfWorkerRequest =
  | { kind: 'training'; worker: WorkerInfo; item: TrainingItemData }
  | { kind: 'ojt'; worker: WorkerInfo; item: OjtUserData }
  | { kind: 'evaluation'; worker: WorkerInfo; item: EvaluationData }
  | {
      kind: 'bulk';
      worker: WorkerInfo;
      trainingData: TrainingItemData[];
      ojtData: OjtUserData[];
      evaluationData: EvaluationData | null;
    };

export type PdfWorkerResponse =
  | { ok: true; buffer: ArrayBuffer }
  | { ok: false; error: string };

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  try {
    const req = event.data;
    let pages: ReactElement[];

    switch (req.kind) {
      case 'training':
        pages = [
          <TrainingRecordPage
            key="p"
            worker={req.worker}
            item={req.item.item}
            subtopics={req.item.subtopics}
            sessions={req.item.sessions}
            approval={req.item.approval}
          />,
        ];
        break;
      case 'ojt':
        pages = [
          <OjtRecordPage
            key="p"
            worker={req.worker}
            ojtUser={req.item.ojtUser}
            records={req.item.records}
          />,
        ];
        break;
      case 'evaluation':
        pages = [
          <FinalEvaluationPage key="p" worker={req.worker} evaluation={req.item} />,
        ];
        break;
      case 'bulk':
        pages = [
          ...req.trainingData.map((itemData) => (
            <TrainingRecordPage
              key={`training-${itemData.item.id}`}
              worker={req.worker}
              item={itemData.item}
              subtopics={itemData.subtopics}
              sessions={itemData.sessions}
              approval={itemData.approval}
            />
          )),
          ...req.ojtData.map((userData) => (
            <OjtRecordPage
              key={`ojt-${userData.ojtUser.id}`}
              worker={req.worker}
              ojtUser={userData.ojtUser}
              records={userData.records}
            />
          )),
          ...(req.evaluationData
            ? [
                <FinalEvaluationPage
                  key="evaluation"
                  worker={req.worker}
                  evaluation={req.evaluationData}
                />,
              ]
            : []),
        ];
        break;
    }

    const blob = await pdf(<Document>{pages}</Document>).toBlob();
    const buffer = await blob.arrayBuffer();
    const response: PdfWorkerResponse = { ok: true, buffer };
    (self as unknown as Worker).postMessage(response, [buffer]);
  } catch (err) {
    const response: PdfWorkerResponse = { ok: false, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(response);
  }
};
