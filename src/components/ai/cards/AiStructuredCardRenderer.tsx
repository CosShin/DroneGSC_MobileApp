import React from 'react';
import type { SemanticStructuredCard } from '../../../services/ai/AiTypes';
import { AiFlightStatusCard } from './AiFlightStatusCard';
import { AiCameraAnalysisCard } from './AiCameraAnalysisCard';
import { AiWarningCard } from './AiWarningCard';

interface Props {
  card: SemanticStructuredCard;
}

export const AiStructuredCardRenderer = React.memo(function AiStructuredCardRenderer({ card }: Props) {
  switch (card.type) {
    case 'FLIGHT_STATUS':
    case 'PREFLIGHT_CHECK':
    case 'MAVLINK_DIAG':
      return <AiFlightStatusCard card={card} />;

    case 'CAMERA_ANALYSIS':
      return <AiCameraAnalysisCard card={card} />;

    case 'WARNING':
      return <AiWarningCard card={card} />;

    default:
      return <AiFlightStatusCard card={card} />;
  }
});
