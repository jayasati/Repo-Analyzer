$OutputFile = "baseline-test-output.txt"

Write-Output "Running Repo Analyzer Tests" | Out-File $OutputFile
Write-Output "============================" | Out-File $OutputFile -Append

function Run-Test($file) {

    Write-Output "" | Out-File $OutputFile -Append
    Write-Output "====================================" | Out-File $OutputFile -Append
    Write-Output "TEST: $file" | Out-File $OutputFile -Append
    Write-Output "====================================" | Out-File $OutputFile -Append

    npx ts-node $file 2>&1 | Out-File $OutputFile -Append
}

Run-Test "src/analysis/scoring/architecture-score.test.ts"
Run-Test "src/analysis/metrics/architecture-metrics.test.ts"
Run-Test "src/analysis/baseline/baseline.test.ts"
Run-Test "src/analysis/cycles/cycle-detector.test.ts"
Run-Test "src/analysis/smells/smell-detector.test.ts"
Run-Test "src/analysis/confidence/confidence.test.ts"
Run-Test "src/core/pipeline/pipeline.test.ts"
Run-Test "src/parser/parser.test.ts"
Run-Test "src/parser/semantic.test.ts"
Run-Test "src/semantic/semantic.test.ts"
Run-Test "src/diagram/diagram-render.test.ts"

Write-Output "" | Out-File $OutputFile -Append
Write-Output "ALL TESTS COMPLETED" | Out-File $OutputFile -Append