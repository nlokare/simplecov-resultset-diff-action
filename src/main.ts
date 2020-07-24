import * as path from 'path'
import * as fs from 'fs'
import * as github from '@actions/github'
import * as core from '@actions/core'
import markdownTable from 'markdown-table'
import {ResultSet, Coverage, getCoverageDiff} from './simplecov'

function doesPathExists(filepath: string): void {
  if (!fs.existsSync(filepath)) {
    throw new Error(`${filepath} does not exist!`)
  }
}

function parseResultset(resultsetPath: string): ResultSet {
  const content = fs.readFileSync(
    path.resolve(process.env.GITHUB_WORKSPACE!, resultsetPath)
  )
  return JSON.parse(content.toString()) as ResultSet
}

async function run(): Promise<void> {
  try {
    const resultsetPaths = {
      base: core.getInput('base-resultset-path'),
      head: core.getInput('head-resultset-path')
    }

    const paths = {
      base: path.resolve(process.cwd(), resultsetPaths.base),
      head: path.resolve(process.cwd(), resultsetPaths.head)
    }

    doesPathExists(paths.base)
    doesPathExists(paths.head)

    const resultsets = {
      base: parseResultset(paths.base),
      head: parseResultset(paths.head)
    }

    const coverages = {
      base: new Coverage(resultsets.base),
      head: new Coverage(resultsets.head)
    }

    const diff = getCoverageDiff(coverages.base, coverages.head)

    let content: string
    if (diff.length === 0) {
      content = 'No differences'
    } else {
      content = markdownTable([
        ['Filename', 'Lines', 'Branches'],
        ...diff.map(d => [d.filename, String(d.lines), String(d.branches)])
      ])
    }

    const message = `## Coverage difference
${content}
`

    /**
     * Publish a comment in the PR with the diff result.
     */
    const octokit = github.getOctokit(core.getInput('token'))

    const pullRequestId = github.context.issue.number
    if (!pullRequestId) {
      core.warning('Cannot find the PR id.')
      core.info(message)
      return
    }

    await octokit.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: pullRequestId,
      body: message
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
