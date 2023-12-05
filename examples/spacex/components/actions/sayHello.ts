'use server'

import { graphql } from '@/fuse'
import { createClient, registerClient } from 'fuse/next/server'
import { redirect } from 'next/navigation'

const { getClient } = registerClient(() =>
  createClient({
    url:
      process.env.NODE_ENV === 'production'
        ? 'https://spacex-fuse.vercel.app/api/fuse'
        : 'http://localhost:3000/api/fuse',
  }),
)

const SayHello = graphql(`
  mutation Hello($name: String!) {
    sayHello(name: $name)
  }
`)

export async function sayHello(args: { name: string }) {
  const client = getClient()
  const result = await client
    .mutation(SayHello, { name: args.name || 'fuse' })
    .toPromise()

  console.log(result.data?.sayHello)

  redirect('/')
}
