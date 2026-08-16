import { useParams } from 'react-router-dom';
import { ConstructionDetail } from '../components/construction/ConstructionDetail';

export function ConstructionDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ConstructionDetail projectId={id ?? ''} />;
}
