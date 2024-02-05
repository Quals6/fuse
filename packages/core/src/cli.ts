#!/usr/bin/env node
import sade from 'sade'
import path from 'path'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import { createServer, build } from 'vite'
import { VitePluginNode } from 'vite-plugin-node'
import { generate, CodegenContext } from '@graphql-codegen/cli'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'

import { isUsingGraphQLTada, tadaGqlContents } from './utils/gql-tada'

const prog = sade('fuse')

prog.version(process.env.npm_package_version ?? '0.0.0')

prog
  .command('build')
  .describe('Creates the build output for server and client.')
  .option(
    '--adapter',
    'Which adapter to use for building, options are lambda, cloudflare, bun and node (default)',
    'node',
  )
  .option(
    '--server',
    'Whether to look for the "types/" directory and create a server build output.',
  )
  .option(
    '--client',
    'Whether to look for GraphQL documents and generate types.',
  )
  .option(
    '--schema',
    'Where to find the schema, either a "*.graphql" file or an endpoint that can be introspected.',
    './schema.graphql',
  )
  .action(async (opts) => {
    if (!opts.server && !opts.client) {
      opts.server = true
      opts.client = true
    }

    if (opts.server) {
      const baseDirectory = process.cwd()
      let entryPoint = 'node.mjs'
      switch (opts.adapter) {
        case 'lambda': {
          entryPoint = 'lambda.mjs'
          break
        }
        case 'bun': {
          entryPoint = 'bun.mjs'
          break
        }
        case 'cloudflare': {
          entryPoint = 'cloudflare.mjs'
          break
        }
        default: {
          entryPoint = 'node.mjs'
          break
        }
      }

      await build({
        build: {
          outDir: path.resolve(baseDirectory, 'build'),
          rollupOptions: {
            logLevel: 'silent',
          },
        },
        plugins: [
          ...VitePluginNode({
            async adapter() {
              // Redundant during build
            },
            appName: 'fuse',
            appPath: path.resolve(
              baseDirectory,
              'node_modules',
              'fuse',
              'dist',
              'adapters',
              entryPoint,
            ),
            exportName: 'main',
          }),
        ],
      })

      console.log('Server build output created in ./build')
    }
    const baseDirectory = process.cwd()

    if (opts.client) {
      if (!(await isUsingGraphQLTada(baseDirectory))) {
        await boostrapCodegen(opts.schema, false)
      } else {
        const hasSrcDir = existsSync(path.resolve(baseDirectory, 'src'))
        const base = hasSrcDir
          ? path.resolve(baseDirectory, 'src')
          : baseDirectory

        if (!(await fs.exists(path.resolve(base, 'fuse')))) {
          await fs.mkdir(path.resolve(base, 'fuse'))
        }

        await Promise.allSettled([
          fs.writeFile(
            path.resolve(base, 'fuse/index.ts'),
            `// This is a generated file!\n\nexport * from './tada';\nexport * from 'fuse/client';\n`,
          ),
          fs.writeFile(path.resolve(base, 'fuse/tada.ts'), tadaGqlContents),
        ])
      }
    }
  })
  .command('dev')
  .describe('Runs the dev-server for the client and server by default.')
  .option(
    '--port',
    'Which port to use for the dev-server (default: 4000)',
    4000,
  )
  .option(
    '--server',
    'Whether to look for the "types/" directory and create a server build output.',
  )
  .option(
    '--client',
    'Whether to look for GraphQL documents and generate types.',
  )
  .option(
    '--schema',
    'Where to find the schema, either a "*.graphql" file or an endpoint that can be introspected.',
    './schema.graphql',
  )
  .action(async (opts) => {
    if (!opts.server && !opts.client) {
      opts.server = true
      opts.client = true
    }

    const baseDirectory = process.cwd()
    const isUsingTada = opts.client && (await isUsingGraphQLTada(baseDirectory))

    if (opts.server) {
      let yoga
      const server = await createServer({
        plugins: [
          ...VitePluginNode({
            initAppOnBoot: true,
            async adapter({ app, req, res }) {
              yoga = await app(opts).then((yo) => {
                fs.writeFile(
                  path.resolve(baseDirectory, 'schema.graphql'),
                  yo.stringifiedSchema,
                  'utf-8',
                )

                return yo
              })
              await yoga.handle(req, res)
            },
            appPath: path.resolve(
              baseDirectory,
              'node_modules',
              'fuse',
              'dist',
              'dev.mjs',
            ),
            exportName: 'main',
          }),
        ],
      })

      server.watcher.on('change', async (file) => {
        if (file.includes('types/')) {
          if (isUsingTada) {
            setTimeout(() => {
              fetch(
                `http://localhost:${opts.port}/api/graphql?query={__typename}`,
              )
            }, 500)
          }
          server.restart()
        }
      })

      await server.listen(opts.port)
      console.log(`Server listening on http://localhost:${opts.port}/graphql`)
    }

    if (opts.client) {
      if (!isUsingTada) {
        setTimeout(() => {
          fetch(
            `http://localhost:${opts.port}/api/graphql?query={__typename}`,
          ).then(() => {
            boostrapCodegen(opts.schema, true)
          })
        }, 1000)
      } else {
        setTimeout(() => {
          fetch(`http://localhost:${opts.port}/api/graphql?query={__typename}`)
        }, 1000)
        const hasSrcDir = existsSync(path.resolve(baseDirectory, 'src'))
        const base = hasSrcDir
          ? path.resolve(baseDirectory, 'src')
          : baseDirectory

        if (!existsSync(path.resolve(base, 'fuse'))) {
          await fs.mkdir(path.resolve(base, 'fuse'))
        }

        await Promise.allSettled([
          fs.writeFile(
            path.resolve(base, 'fuse/index.ts'),
            `// This is a generated file!\n\nexport * from './tada';\nexport * from 'fuse/client';\n`,
          ),
          fs.writeFile(path.resolve(base, 'fuse/tada.ts'), tadaGqlContents),
        ])
      }
    }
  })

prog.parse(process.argv)

async function boostrapCodegen(location: string, watch: boolean) {
  const baseDirectory = process.cwd()
  const hasSrcDir = existsSync(path.resolve(baseDirectory, 'src'))

  const contents = `export * from "./fragment-masking";
export * from "./gql";
export * from "fuse/client";\n`
  const ctx = new CodegenContext({
    filepath: 'codgen.yml',
    config: {
      ignoreNoDocuments: true,
      errorsOnly: true,
      noSilentErrors: true,
      hooks: {
        afterOneFileWrite: async () => {
          await fs.writeFile(
            hasSrcDir
              ? baseDirectory + '/src/fuse/index.ts'
              : baseDirectory + '/fuse/index.ts',
            contents,
          )
        },
      },
      watch: watch
        ? [
            hasSrcDir
              ? baseDirectory + '/src/**/*.{ts,tsx}'
              : baseDirectory + '/**/*.{ts,tsx}',
            '!./{node_modules,.next,.git}/**/*',
            hasSrcDir ? '!./src/fuse/*.{ts,tsx}' : '!./fuse/*.{ts,tsx}',
          ]
        : false,
      schema: location,
      generates: {
        [hasSrcDir ? baseDirectory + '/src/fuse/' : baseDirectory + '/fuse/']: {
          documents: [
            hasSrcDir ? './src/**/*.{ts,tsx}' : './**/*.{ts,tsx}',
            '!./{node_modules,.next,.git}/**/*',
            hasSrcDir ? '!./src/fuse/*.{ts,tsx}' : '!./fuse/*.{ts,tsx}',
          ],
          preset: 'client',
          // presetConfig: {
          //   persistedDocuments: true,
          // },
          config: {
            scalars: {
              ID: {
                input: 'string',
                output: 'string',
              },
              DateTime: DateTimeResolver.extensions.codegenScalarType,
              JSON: JSONResolver.extensions.codegenScalarType,
            },
            avoidOptionals: false,
            enumsAsTypes: true,
            nonOptionalTypename: true,
            skipTypename: false,
          },
        },
      },
    },
  })

  await generate(ctx, true)
}
