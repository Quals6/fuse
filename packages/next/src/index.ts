import { GetContext, builder } from 'fuse'
import { NextApiRequest, NextPageContext, NextApiResponse } from 'next'
import { createYoga, YogaInitialContext } from 'graphql-yoga'
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream'
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection'
import { blockFieldSuggestionsPlugin } from '@escape.tech/graphql-armor-block-field-suggestions'

export function datalayer(ctx?: GetContext<YogaInitialContext>) {
  return (request: Request, context: NextPageContext) => {
    if (process.env.NODE_ENV === 'production') {
      const completedSchema = builder.toSchema({})
      const { handleRequest } = createYoga({
        graphiql: false,
        maskedErrors: true,
        schema: completedSchema,
        // We allow batching by default
        batching: true,
        context: ctx,
        // While using Next.js file convention for routing, we need to configure Yoga to use the correct endpoint
        graphqlEndpoint: '/api/datalayer',

        // Yoga needs to know how to create a valid Next response
        fetchAPI: { Response },
        plugins: [
          useDeferStream(),
          useDisableIntrospection(),
          blockFieldSuggestionsPlugin(),
        ],
      })

      return handleRequest(request, context)
    } else {
      const completedSchema = builder.toSchema({})
      const { handleRequest } = createYoga({
        graphiql: true,
        maskedErrors: false,
        schema: completedSchema,
        // We allow batching by default
        batching: true,
        context: ctx,
        // While using Next.js file convention for routing, we need to configure Yoga to use the correct endpoint
        graphqlEndpoint: '/api/datalayer',

        // Yoga needs to know how to create a valid Next response
        fetchAPI: { Response },
        plugins: [useDeferStream()],
      })

      return handleRequest(request, context)
    }
  }
}

export function datalayerPage(
  ctx?: GetContext<{ req: NextApiRequest; res: NextApiResponse }>,
) {
  const schema = builder.toSchema({})
  return createYoga<{
    req: NextApiRequest
    res: NextApiResponse
  }>({
    schema,
    graphiql: process.env.NODE_ENV !== 'production',
    maskedErrors: process.env.NODE_ENV === 'production',
    batching: true,
    context: ctx,
    graphqlEndpoint: '/api/datalayer',
    plugins: [
      useDeferStream(),
      process.env.NODE_ENV === 'production' && useDisableIntrospection(),
      process.env.NODE_ENV === 'production' && blockFieldSuggestionsPlugin(),
    ].filter(Boolean),
  })
}
