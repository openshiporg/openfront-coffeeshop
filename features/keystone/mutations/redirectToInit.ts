type RedirectToInitContext = {
  sudo(): {
    query: {
      User: {
        count(args: Record<string, never>): Promise<number>;
      };
    };
  };
};

async function redirectToInit(_root: unknown, _args: Record<string, never>, context: RedirectToInitContext) {
  const userCount = await context.sudo().query.User.count({});
  return userCount === 0;
}

export default redirectToInit;
