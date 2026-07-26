import { type AggregateReadRepository, getDashboard } from '@eternal-word/application'
import type { DashboardStatsDto } from '@eternal-word/shared/contracts'
import { type HttpResponse, json } from './http.js'

/** GET the global dashboard aggregates in one payload (counts, adopters, books
 * and chapters begun, the SOL estimate and the cumulative trend). */
export async function handleDashboard(repo: AggregateReadRepository): Promise<HttpResponse> {
  const stats: DashboardStatsDto = await getDashboard(repo)
  return json(200, stats)
}
