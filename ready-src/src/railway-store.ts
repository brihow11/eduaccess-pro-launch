type StoreResult = {
  data: null;
  error: null;
  count: number;
};

const emptyResult: StoreResult = { data: null, error: null, count: 0 };

function createQueryChain(): any {
  const chain: any = {};
  const methods = [
    'select', 'eq', 'gte', 'order', 'limit', 'insert', 'upsert', 'update',
    'delete', 'single', 'maybeSingle',
  ];

  for (const method of methods) {
    chain[method] = () => chain;
  }

  chain.then = (resolve: (value: StoreResult) => unknown) =>
    Promise.resolve(emptyResult).then(resolve);

  return chain;
}

export function createRailwayStore(): any {
  return {
    from: () => createQueryChain(),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({
        error: new Error('The legacy browser editor is disabled. Content is managed in GitHub and Railway.'),
      }),
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => ({
          data: null,
          error: new Error('Browser uploads are disabled. Add media through the deployment repository.'),
        }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };
}
