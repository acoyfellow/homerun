import { renderOgImage } from './_shared';

export async function GET() {
  return renderOgImage(
    'API Directory',
    'Community-discovered APIs — browse, search, and add your own. No docs required.'
  );
}
