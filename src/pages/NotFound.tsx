import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        icon={<Compass size={24} />}
        title="Page not found"
        description="This route does not exist in the workspace."
        action={
          <Link to="/" className="btn btn-primary btn-md">
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
