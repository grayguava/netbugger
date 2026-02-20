import { runIdleTest } from "../tests/idle-test.js";
import { classifyAll } from "../analysis/classify.js";
import { diagnose } from "../analysis/diagnose.js";
import { interpret, summarize } from "../analysis/interpret.js";

/**
 * Runs full diagnostics pipeline
 * Returns a complete report object
 */

export async function runConnectionDiagnostics(options = {}) {

    const report = {
        timestamp: Date.now(),
        raw: null,
        classification: null,
        findings: null,
        messages: null,
        summary: null
    };

    // 1) collect measurements
    report.raw = await runIdleTest(options);

    // 2) classify metrics
    report.classification = classifyAll({
        latency: report.raw.latency,
        handshake: report.raw.handshake,
        stability: report.raw.latency,
        capacity: report.raw.capacity
    });

    // 3) determine causes
    report.findings = diagnose(report.classification, report.raw.info);

    // 4) human readable messages
    report.messages = interpret(report.findings);

    // 5) single-line conclusion
    report.summary = summarize(report.findings);

    return report;
}
