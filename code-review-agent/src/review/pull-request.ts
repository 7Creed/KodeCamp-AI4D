export async function getPullRequestDiff(pullRequestUrl: string) {
  const url = new URL(pullRequestUrl);

  if (url.hostname !== 'github.com') {
    throw new Error('Only GitHub pull request URLs are currently supported.');
  }

  if (!/^\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(url.pathname)) {
    throw new Error('Invalid GitHub pull request URL.');
  }

  const diffUrl = `${url.origin}${url.pathname.replace(/\/$/, '')}.diff`;

  const response = await fetch(diffUrl, {
    headers: {
      Accept: 'application/vnd.github.v3.diff',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load pull request diff: ${response.status}`);
  }

  return response.text();
}
