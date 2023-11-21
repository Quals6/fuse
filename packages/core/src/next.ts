import fs from 'fs'
import { createYoga } from 'graphql-yoga'
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream'
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection'
import { blockFieldSuggestionsPlugin } from '@escape.tech/graphql-armor-block-field-suggestions'

import { builder } from './builder'

const cwd = process.cwd()
export async function datalayer() {
  let ctx

  const promises: Array<Promise<any>> = []
  fs.readdirSync(`${cwd}/types`).forEach((file) => {
    promises.push(import(`${cwd}/types/${file}`))
  })
  await Promise.all(promises)

  return (request: Request) => {
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
        // useDisableIntrospection(),
        // blockFieldSuggestionsPlugin(),
      ],
    })

    return handleRequest(request, ctx)
  }
}
