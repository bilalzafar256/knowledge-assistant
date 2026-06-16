# Eval run: `p1-contextual-200q-gategrade`

- **Started:** 2026-06-16T10:21:11.924Z
- **Duration:** 1214s
- **Chat model:** `claude-sonnet-4-6`
- **Embedding model:** `gemini-embedding-001`
- **Judge model:** `gemini-2.5-flash`
- **Top-K:** 5
- **Golden set:** 200 questions (generated 2026-06-16T10:21:03.281Z)

## Retrieval
| Metric | Value |
| --- | --- |
| Recall@5 (after rerank) | **85.0%** |
| Recall@5 (candidate pool) | 84.5% |
| Recall@10 (candidate pool) | 92.5% |
| Recall@5 (pure vector — diagnostic) | 83.5% |
| Recall@10 (pure vector — diagnostic) | 92.5% |
| MRR (reranked) | 0.624 |
| MRR (candidate pool) | 0.695 |
| MRR (pure vector — diagnostic) | 0.696 |
| Context precision | 50.8% |

## Answer quality
| Metric | Value |
| --- | --- |
| Faithfulness | **95.6%** |
| Correctness | **65.2%** |
| Citation accuracy | 97.3% |
| Avg latency | 18728 ms |
| Total input tokens | 1,067,749 |
| Total output tokens | 117,983 |
| Estimated cost | $4.9730 |

## Breakdown by modality (`benchmark.source`)
| Modality | Count | Recall@k | MRR | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: |
| text | 132 | 88.6% | 0.632 | 95.6% | 70.9% |
| text-image | 49 | 75.5% | 0.584 | 95.9% | 53.8% |
| text-table-image | 13 | 76.9% | 0.622 | 100.0% | 53.1% |
| text-table | 6 | 100.0% | 0.792 | 83.3% | 58.3% |

## Breakdown by query type (`benchmark.type`)
| Type | Count | Recall@k | MRR | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: |
| abstractive | 123 | 83.7% | 0.641 | 95.9% | 59.3% |
| extractive | 77 | 87.0% | 0.597 | 95.1% | 74.5% |

## Per-question
| ID | Recall@k | MRR | CtxP | Faith | Corr | Cite | Question |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| q_1 | 1 | 1.00 | 0.60 | 1.00 | 0.00 | 1.00 | How do BASE-T and ADA-T models differ in their prediction performance for peptid |
| q_2 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | What are some improvements made to classical stochastic gradient descent? |
| q_3 | 1 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | Does the MRP safety stock exploitation heuristic prevent planning nervousness? |
| q_4 | 1 | 0.33 | 0.20 | 1.00 | 1.00 | 1.00 | Are there recent advances that establish asymptotic validity for randomization t |
| q_5 | 1 | 1.00 | 0.40 | 1.00 | 0.70 | 1.00 | How do different volatility models compare over time when analyzing parameter $\ |
| q_6 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | What is a fixed-fee AMM (ff-AMM)? |
| q_7 | 0 | 0.00 | 0.80 | 1.00 | 1.00 | 1.00 | Do existing methods for AQA explore audio information in videos? |
| q_8 | 1 | 0.50 | 1.00 | 1.00 | 0.50 | 1.00 | What implications do new findings on distribution function limits have for causa |
| q_9 | 1 | 0.33 | 0.40 | 1.00 | 0.80 | 1.00 | How does quantum efficiency affect power output in dual radiative engines compar |
| q_10 | 1 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | What are the key phases of the mammalian cell cycle and their checkpoints? |
| q_11 | 1 | 1.00 | 0.80 | 1.00 | 0.20 | 1.00 | What is the significance of quasi-thermostatic CRN in chemical reaction networks |
| q_12 | 1 | 1.00 | 0.20 | 1.00 | 0.40 | 1.00 | What institutional factors were investigated to see if they correlated with scho |
| q_13 | 0 | 0.00 | 0.60 | 1.00 | 0.90 | 1.00 | What is the significance of the classical exceptional series in knot theory? |
| q_14 | 0 | 0.00 | 1.00 | 1.00 | 0.70 | 1.00 | How does the LeqMod strategy improve PET image denoising? |
| q_15 | 1 | 1.00 | 0.60 | 1.00 | 0.90 | 1.00 | What role does parameter $\kappa$ play in shaping trading trajectories for IS an |
| q_16 | 1 | 0.33 | 0.20 | 1.00 | 0.00 | 1.00 | How do codiagonals function within a preadhesive structure in category theory? |
| q_17 | 1 | 0.25 | 0.80 | 1.00 | 0.00 | 1.00 | How do intra-attention and inter-attention mechanisms function in speech-noise i |
| q_18 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Is the Riemann-Liouville fractional Brownian motion used in rough volatility mod |
| q_19 | 1 | 0.50 | 0.20 | 1.00 | 0.90 | 1.00 | Can uniqueness be ensured for the entire range of $\phi \in\left(0, \phi_{b}\rig |
| q_20 | 1 | 1.00 | 1.00 | 1.00 | 0.50 | 1.00 | What is the significance of the Rubin causal model in causal inference? |
| q_21 | 1 | 1.00 | 0.80 | 1.00 | 1.00 | 1.00 | Is learning the score function efficiently part of the algorithm's framework in  |
| q_22 | 1 | 1.00 | 0.80 | 1.00 | 0.00 | 1.00 | What conditions lead to synergism in Domar aggregation of productivity shocks? |
| q_23 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Does the probabilistic counter use more than $\mathcal{O}(1)$ bits to detect if  |
| q_24 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | What is the goal in maximizing $\mathbb{P}\left(W^{*}=1 \mid W^{\prime}=1\right) |
| q_25 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Is detailed justification required when refining problems during the curation pr |
| q_26 | 1 | 1.00 | 0.80 | 1.00 | 0.80 | 1.00 | How do detailed text descriptions enhance molecule generation processes? |
| q_27 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | What is the purpose of using a Signal-to-Noise Ratio (SNR) in speech datasets? |
| q_28 | 1 | 0.33 | 0.60 | 1.00 | 1.00 | 1.00 | Why is there a need to study maxitivity with respect to general orders beyond po |
| q_29 | 1 | 0.25 | 0.20 | 0.90 | 0.00 | 1.00 | Does Sklar's theorem state that there exists a copula for any two-dimensional cd |
| q_30 | 0 | 0.00 | 0.60 | 1.00 | 0.90 | 1.00 | What happens if an agent lies about their costs in PFL? |
| q_31 | 1 | 1.00 | 0.80 | 1.00 | 0.50 | 1.00 | What are the key differences between implementation shortfall and target close t |
| q_32 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | How does a two-dimensional scaling plot help in analyzing financial datasets? |
| q_33 | 1 | 0.33 | 0.20 | 1.00 | 1.00 | 1.00 | What happens to outgoing transitions from the final state in an rDFA for a suffi |
| q_34 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | What are the key differences in lead time performance between FOP and FOQ across |
| q_35 | 1 | 0.33 | 1.00 | 1.00 | 0.00 | 1.00 | How can superconducting circuits demonstrate collective advantage over independe |
| q_36 | 0 | 0.00 | 0.80 | 1.00 | 0.90 | 1.00 | Why are RGB frames and optical flows important in analyzing video segments for g |
| q_37 | 1 | 0.25 | 0.60 | 1.00 | 1.00 | 1.00 | Why is it important for a simulator to have both fast prototyping capabilities a |
| q_38 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | Were the animal experiments approved by an ethics review board? |
| q_39 | 1 | 0.50 | 1.00 | 1.00 | 1.00 | 1.00 | What algorithm is used for knowledge transfer between classes? |
| q_40 | 1 | 0.25 | 0.20 | 1.00 | 1.00 | 1.00 | Does a reproducing kernel Hilbert space (RKHS) uniquely define a kernel? |
| q_41 | 1 | 1.00 | 0.40 | 0.00 | 0.00 | 0.00 | What is the distribution function of the difference of two random variables $X$  |
| q_42 | 1 | 0.50 | 0.20 | 0.00 | 0.00 | 0.00 | Are there any studies that extend analysis to settings with multiple treatments  |
| q_43 | 0 | 0.00 | 0.20 | 1.00 | 0.50 | 1.00 | What impact do transaction costs have on aligning optimal trading strategies wit |
| q_44 | 0 | 0.00 | 0.40 | 1.00 | 1.00 | 1.00 | What method is used to solve the constrained optimization problem in minimizing  |
| q_45 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | Is there an upper bound for payments to agents in contract design? |
| q_46 | 1 | 0.25 | 0.60 | 1.00 | 0.20 | 1.00 | How does adding a maximum-power constraint affect cycling strategies for minimiz |
| q_47 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | Is the withdrawal fee intended to protect managers from strategic liquidity with |
| q_48 | 1 | 0.33 | 1.00 | 1.00 | 0.50 | 1.00 | How does the concept of disks relate to matchings between two point sets? |
| q_49 | 1 | 1.00 | 0.60 | 1.00 | 0.00 | 1.00 | In what scenarios does NMPC differ from cKoLPV-MPC? |
| q_50 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | What is the optimal amount of data used for local training by an agent with marg |
| q_51 | 1 | 0.33 | 0.60 | 1.00 | 0.50 | 1.00 | How does a causal Bayes net represent causal structures in medical studies? |
| q_52 | 1 | 0.33 | 0.60 | 1.00 | 0.25 | 1.00 | What are the challenges in assembling diploid genomes compared to haploid genome |
| q_53 | 1 | 0.20 | 0.80 | 1.00 | 0.50 | 1.00 | What metrics were used to evaluate the performance of different sensor control m |
| q_54 | 1 | 1.00 | 0.80 | 1.00 | 0.20 | 1.00 | What is the Optimal Prefix Hit Recursion (OPHR) algorithm used for in data analy |
| q_55 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | What challenges do liquidity providers face in automated market makers? |
| q_56 | 0 | 0.00 | 0.80 | 0.80 | 0.00 | 1.00 | Does attention-based generation perform a form of soft alignment? |
| q_57 | 1 | 0.50 | 0.60 | 1.00 | 0.00 | 1.00 | Are PFAS associated with thyroid disruption in humans? |
| q_58 | 1 | 0.25 | 0.80 | 1.00 | 1.00 | 1.00 | What is the purpose of Unsolvable Problem Detection (UPD)? |
| q_59 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | What is the purpose of information fusion in sensor nodes? |
| q_60 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Why is there a spike at zero novelty in generated scaffolds? |
| q_61 | 1 | 0.50 | 0.40 | 1.00 | 1.00 | 1.00 | Does the construction of a one-step estimator involve multiple steps? |
| q_62 | 1 | 1.00 | 0.40 | 0.00 | 0.00 | 0.00 | Do sub-exponential random variables have fast decaying tails? |
| q_63 | 1 | 0.50 | 1.00 | 1.00 | 1.00 | 1.00 | What is the relationship between coherent risk measures and uniform integrabilit |
| q_64 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | Can Kohn's theorem be bypassed to couple LLL to a constant electric field, and i |
| q_65 | 1 | 0.25 | 0.20 | 1.00 | 1.00 | 1.00 | What does it mean for two words to be separated by a language? |
| q_66 | 1 | 0.50 | 0.60 | 1.00 | 1.00 | 1.00 | Has CEM been challenged in scientific communities for more than two decades? |
| q_67 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | Is it challenging to quantify the landscape for high-dimensional oscillatory sys |
| q_68 | 1 | 0.33 | 0.20 | 1.00 | 1.00 | 1.00 | Are prefecture-level sampling rates for top income earners consistent across pre |
| q_69 | 1 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | Can subjective beliefs replace objective stochastic processes in this approach? |
| q_70 | 1 | 0.33 | 0.20 | 1.00 | 1.00 | 1.00 | How does a longer planned lead time affect service levels in scenarios with bias |
| q_71 | 1 | 1.00 | 0.20 | 1.00 | 0.50 | 1.00 | Does the Voronoi loss function apply to over-specified settings in cosine router |
| q_72 | 1 | 0.33 | 0.20 | 1.00 | 0.50 | 1.00 | Are there significant differences in absolute sensitivity between conditions whe |
| q_73 | 1 | 0.50 | 1.00 | 1.00 | 0.00 | 1.00 | What is the concept of unambiguous efficiency in allocation models? |
| q_74 | 1 | 0.25 | 1.00 | 1.00 | 0.50 | 1.00 | How does the number of qubits influence superradiant heat current enhancement? |
| q_75 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | What is the role of symmetric matrices in algebraic K-theory with involution? |
| q_76 | 1 | 1.00 | 0.80 | 1.00 | 1.00 | 1.00 | What are the optimal wavelength ranges for creating repulsive optical potentials |
| q_77 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | Why might observed roughness not reflect the true nature of spot volatility proc |
| q_78 | 1 | 1.00 | 0.60 | 1.00 | 0.90 | 1.00 | What are Hurwitz algebras and how do they relate to vector product algebras? |
| q_79 | 1 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | Does the use of LeqMod improve lesion visibility in low-count PET images? |
| q_80 | 1 | 1.00 | 0.40 | 1.00 | 0.20 | 1.00 | Why is a quadratic function used for approximating short-term implied volatility |
| q_81 | 0 | 0.00 | 1.00 | 1.00 | 0.00 | 1.00 | How do configurations impact the performance of regularized principal spline fun |
| q_82 | 1 | 0.50 | 0.80 | 1.00 | 1.00 | 1.00 | Do the necessary conditions guarantee successful output if they fail? |
| q_83 | 1 | 0.33 | 0.60 | 1.00 | 0.50 | 1.00 | How does Virtuoso improve the process of simulating virtual memory systems? |
| q_84 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | How do $\mathcal{M}, \mathcal{N}$-adhesive categories extend the concept of (qua |
| q_85 | 1 | 0.25 | 0.00 | 1.00 | 0.00 | 1.00 | What is the estimated peak fiscal spending multiplier during the Great Inflation |
| q_86 | 1 | 0.20 | 0.20 | 0.00 | 0.00 | 1.00 | How is body posture observed using RGB information in video analysis? |
| q_87 | 1 | 0.50 | 0.80 | 1.00 | 0.75 | 1.00 | How do non-Euclidean embeddings compare to Euclidean embeddings for biological p |
| q_88 | 1 | 0.33 | 0.60 | 1.00 | 0.20 | 1.00 | What is the purpose of the Virtual Lung Screening Trial (VLST)? |
| q_89 | 1 | 0.25 | 0.40 | 1.00 | 0.50 | 1.00 | How does the seemingly unrelated BART model improve upon traditional multivariat |
| q_90 | 1 | 0.33 | 0.60 | 1.00 | 0.50 | 1.00 | Why are MHC I and MHC II important in immunological studies? |
| q_91 | 0 | 0.00 | 0.20 | 1.00 | 0.00 | 1.00 | Why are hub genes significant in microbiome research? |
| q_92 | 1 | 0.50 | 0.40 | 1.00 | 1.00 | 1.00 | How does the weight parameter influence symmetric loss in regression models? |
| q_93 | 0 | 0.00 | 0.80 | 1.00 | 0.50 | 1.00 | What role do trading trajectories play in optimal order execution strategies? |
| q_94 | 1 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | How do tori and general linear groups relate to invariant ideals? |
| q_95 | 1 | 1.00 | 0.60 | 1.00 | 0.00 | 1.00 | What is a warm start in the context of Gaussian mixtures? |
| q_96 | 1 | 0.50 | 0.40 | 1.00 | 0.00 | 1.00 | What does it mean for functions $f_{x}: \Phi \rightarrow \mathbb{R}$ to be lower |
| q_97 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | Can SBR from DAT imaging detect nigrostriatal dopaminergic cell loss accurately? |
| q_98 | 0 | 0.00 | 0.00 | 1.00 | 0.00 | 1.00 | How does effective temperature \( T^* \) relate to temperatures \( T_c \) and \( |
| q_99 | 1 | 1.00 | 0.80 | 1.00 | 1.00 | 1.00 | What role do heterogeneous preferences play in regional agglomeration? |
| q_100 | 1 | 0.25 | 0.40 | 1.00 | 0.50 | 1.00 | What framework is commonly used for analyzing randomized experiments with imperf |
| q_101 | 1 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | What property does the random serial dictatorship allocation mechanism fail to s |
| q_102 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | How does open access code support research in differential equation modeling? |
| q_103 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | How do deep learning models benefit from prioritizing challenging cases with hig |
| q_104 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | Is there a significant performance difference between CT and CXR when stratified |
| q_105 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Is there always a Hamiltonian cycle that is a Tverberg graph for finite planar p |
| q_106 | 0 | 0.00 | 0.80 | 1.00 | 1.00 | 1.00 | Does the topological signature of the FQH state remain robust against non-local  |
| q_107 | 0 | 0.00 | 1.00 | 1.00 | 0.00 | 1.00 | How do different scenarios affect power output and efficiency in these systems? |
| q_108 | 0 | 0.00 | 0.40 | 1.00 | 1.00 | 1.00 | What framework is used for enhanced multi-target tracking in dynamic environment |
| q_109 | 1 | 0.50 | 0.60 | 1.00 | 1.00 | 1.00 | Is it straightforward to label shocks based on estimates of impact matrices $B_{ |
| q_110 | 1 | 1.00 | 0.20 | 1.00 | 0.50 | 1.00 | At what temperature does the validity of generated molecules remain consistently |
| q_111 | 1 | 1.00 | 0.40 | 1.00 | 0.00 | 1.00 | Does a larger bandgap energy ($E_g \gg k_B T_h$) result in higher efficiency at  |
| q_112 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | Why is manual quantification of nigral hyperintensity not feasible for PD monito |
| q_113 | 1 | 0.33 | 0.40 | 1.00 | 0.50 | 1.00 | Does optimizing field order in relational data analytics workloads lead to cost  |
| q_114 | 1 | 0.33 | 1.00 | 1.00 | 0.90 | 1.00 | How do different gradient profiles affect resonance conditions in solid-state sy |
| q_115 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | What is the relationship between nitrogen oxides and tropospheric ozone in envir |
| q_116 | 1 | 1.00 | 0.60 | 1.00 | 0.70 | 1.00 | What role does alpha play in determining cost reductions within extended MRP mod |
| q_117 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | What theoretical rationale supports using multilevel metamodels in simulation st |
| q_118 | 1 | 0.33 | 0.80 | 1.00 | 0.20 | 1.00 | What are some computational results achieved using the quantum exceptional polyn |
| q_119 | 1 | 1.00 | 0.60 | 1.00 | 0.80 | 1.00 | What are the benefits of using a three-level Multilevel Mixed Model in Monte Car |
| q_120 | 1 | 1.00 | 0.20 | 1.00 | 0.00 | 1.00 | How are heterogeneous and homogeneous lung nodules different in medical imaging  |
| q_121 | 0 | 0.00 | 0.80 | 1.00 | 0.50 | 1.00 | How does Enamine REAL Space contribute to experimental setups involving purchasa |
| q_122 | 1 | 1.00 | 0.20 | 1.00 | 0.50 | 1.00 | Does Atomas aim to improve efficiency in retrieval tasks? |
| q_123 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | What is one conventional solution to control false rejections across multiple nu |
| q_124 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | What challenges do large position holders face when executing trades in financia |
| q_125 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | Is the number of bad triangles always less than or equal to the number of charge |
| q_126 | 0 | 0.00 | 1.00 | 1.00 | 0.20 | 1.00 | What are the different types of Bergomi models used for volatility calibration? |
| q_127 | 1 | 0.33 | 0.40 | 1.00 | 1.00 | 1.00 | What condition is required for absolute concentration robustness in the chemical |
| q_128 | 1 | 0.20 | 0.40 | 1.00 | 1.00 | 1.00 | Is there overshooting in the optimal strategy if \( R < A - (x_0 - A)/(\cosh(\ka |
| q_129 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | Is Dicke superradiant emission transient or steady-state by nature? |
| q_130 | 1 | 1.00 | 0.60 | 1.00 | 0.50 | 1.00 | What are the key differences between LPC and Burg algorithms in audio inpainting |
| q_131 | 1 | 1.00 | 0.80 | 1.00 | 0.50 | 1.00 | What role do clustering techniques play in analyzing gene pairs within microbiom |
| q_132 | 1 | 1.00 | 0.20 | 0.50 | 1.00 | 1.00 | Does neglecting changes in kinetic energy become more justifiable for longer asc |
| q_133 | 1 | 0.33 | 0.80 | 1.00 | 1.00 | 1.00 | How do cumulant-based conditions affect different types of volatility models? |
| q_134 | 0 | 0.00 | 1.00 | 1.00 | 0.50 | 1.00 | What role do synthesis constraints play in molecule design? |
| q_135 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | What is a challenge in variance estimation with finely stratified experiments? |
| q_136 | 0 | 0.00 | 0.80 | 1.00 | 0.50 | 1.00 | How do these geometric properties relate to Max-Plus algebras? |
| q_137 | 1 | 1.00 | 0.80 | 1.00 | 0.90 | 1.00 | What is spatial confounding and why is it a problem in statistical models? |
| q_138 | 0 | 0.00 | 0.60 | 1.00 | 0.00 | 1.00 | How can $\mathbb{E}\left[Y(1)-Y(0) \mid W^{*}=1\right]$ be expressed? |
| q_139 | 0 | 0.00 | 0.20 | 1.00 | 1.00 | 1.00 | Is the nested IV relation reflexive and transitive? |
| q_140 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | What determines where workers choose to live in a long-run spatial equilibrium? |
| q_141 | 0 | 0.00 | 0.40 | 1.00 | 0.20 | 1.00 | How do feasibility plots differ between haploid and diploid human chromosomes in |
| q_142 | 1 | 0.33 | 0.40 | 1.00 | 1.00 | 1.00 | Does any VMA exceed a size of 1GB? |
| q_143 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | How do intra-chunk and inter-chunk attention modules differ in their application |
| q_144 | 1 | 1.00 | 0.60 | 1.00 | 0.00 | 1.00 | What is the condition for the Hamiltonian \( H \) to be concave-convex? |
| q_145 | 1 | 1.00 | 0.20 | 1.00 | 0.00 | 1.00 | Is the mean absolute error (MAE) higher at a clipping margin of 0.02 or at a mar |
| q_146 | 1 | 1.00 | 0.80 | 0.00 | 0.00 | 1.00 | What role does wind direction play in sailboat maneuvering strategies? |
| q_147 | 1 | 1.00 | 0.20 | 1.00 | 0.50 | 1.00 | Can you explain how random serial dictatorships relate to HMDs when there are th |
| q_148 | 0 | 0.00 | 0.40 | 1.00 | 1.00 | 0.00 | Is lower better for word-error-rate (WER) when evaluating extracted speech? |
| q_149 | 1 | 0.50 | 0.40 | 1.00 | 1.00 | 1.00 | Does the sender observe the state of the world before sending a signal? |
| q_150 | 1 | 0.25 | 0.40 | 1.00 | 1.00 | 1.00 | Can negative singularity occur with productivity-diminishing innovations? |
| q_151 | 0 | 0.00 | 0.40 | 1.00 | 0.50 | 0.50 | How can permutation tests be used when assessing plots of financial time series? |
| q_152 | 1 | 1.00 | 1.00 | 0.00 | 0.50 | 1.00 | How does the recursive algorithm ensure that all agents receive their preferred  |
| q_153 | 1 | 0.33 | 0.20 | 1.00 | 0.50 | 1.00 | What tasks have been addressed using methods built on the mathematical foundatio |
| q_154 | 1 | 0.33 | 0.40 | 1.00 | 1.00 | 1.00 | Is it possible for expert estimation rates to be as slow as \(\mathcal{O}_{P}(1  |
| q_155 | 0 | 0.00 | 0.20 | 1.00 | 1.00 | 1.00 | Why is microbial growth rate important in determining successful infections? |
| q_156 | 0 | 0.00 | 0.60 | 1.00 | 0.90 | 1.00 | Why is it important to analyze short and long maturities in financial modeling? |
| q_157 | 1 | 0.33 | 0.80 | 1.00 | 0.90 | 1.00 | What is unambiguously efficient allocation? |
| q_158 | 1 | 0.25 | 0.60 | 1.00 | 0.50 | 1.00 | Why is it important to design specific resonators for studying FQH states? |
| q_159 | 1 | 0.33 | 0.20 | 1.00 | 1.00 | 1.00 | Can consistent variance estimators derived via a super-population analysis be re |
| q_160 | 1 | 0.33 | 0.80 | 1.00 | 1.00 | 1.00 | How can convexity properties impact the solutions of Hamilton-Jacobi-Bellman equ |
| q_161 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | How does hierarchical adaptive alignment affect loss curves in model training? |
| q_162 | 0 | 0.00 | 1.00 | 1.00 | 0.20 | 1.00 | Why is it important to consider broadband radiation in these engines? |
| q_163 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | How does fragment-based drug discovery work? |
| q_164 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | How do Large Language Models (LLMs) enhance batch data analytics? |
| q_165 | 1 | 1.00 | 0.80 | 1.00 | 0.50 | 1.00 | How effective is the model in classifying different microbiome habitats based on |
| q_166 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | How does the DDGA method handle diffusion effects in oscillatory systems? |
| q_167 | 1 | 1.00 | 0.60 | 1.00 | 1.00 | 1.00 | Why is the concept of matching classes important in category theory? |
| q_168 | 1 | 1.00 | 0.20 | 1.00 | 0.90 | 1.00 | What does the defensible set of a profile represent in voting methods? |
| q_169 | 1 | 0.50 | 0.20 | 0.00 | 0.00 | 0.00 | Does the transfer learning method outperform the non-transfer method when \( L > |
| q_170 | 1 | 0.50 | 1.00 | 1.00 | 0.90 | 1.00 | What is the significance of weighted estimands in estimating treatment effects? |
| q_171 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | Is the unit cost function homogeneous of the first order in prices $p_0, p_1, \c |
| q_172 | 1 | 0.50 | 0.60 | 1.00 | 1.00 | 1.00 | What happens to partial agglomeration as trade barriers decrease? |
| q_173 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | What role does firm heterogeneity play in international sourcing decisions? |
| q_174 | 0 | 0.00 | 0.40 | 1.00 | 0.50 | 1.00 | What is the switcher average treatment effect (SWATE)? |
| q_175 | 1 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | In what ways do large financial institutions influence market equilibrium prices |
| q_176 | 1 | 1.00 | 0.20 | 0.00 | 0.00 | 1.00 | What is the significance of Euler's proof regarding the sum of reciprocals of pr |
| q_177 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Does using input images at half resolution improve performance compared to highe |
| q_178 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Are there more than two primes satisfying the equation \(y \ln p=2 n \pi+\gamma\ |
| q_179 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | Is the beta-Poisson approximation valid for all values of \(\beta\) and \(\alpha |
| q_180 | 1 | 1.00 | 0.40 | 1.00 | 0.50 | 1.00 | What happens to safety stock levels when there is an increase in uncertainty? |
| q_181 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Can a singular Leontief matrix have all positive or all negative solutions in it |
| q_182 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | Is the operation $\boxplus$ associative? |
| q_183 | 1 | 1.00 | 1.00 | 1.00 | 0.80 | 1.00 | How do private signals among citizens impact their decision-making regarding rev |
| q_184 | 1 | 0.33 | 0.20 | 1.00 | 0.50 | 1.00 | Where can one access the DukeSeg and quality control module code? |
| q_185 | 1 | 1.00 | 0.80 | 1.00 | 0.50 | 1.00 | What is the concept of natural capital as a stock option? |
| q_186 | 0 | 0.00 | 0.80 | 1.00 | 0.50 | 1.00 | How does building block sampling contribute to the design of novel molecules? |
| q_187 | 1 | 1.00 | 0.20 | 1.00 | 0.50 | 1.00 | Why do singularities form in viscosity solutions of HJB equations? |
| q_188 | 1 | 1.00 | 0.60 | 1.00 | 0.00 | 1.00 | What is one reason why decisions to import are considered more complex than deci |
| q_189 | 1 | 0.33 | 0.80 | 1.00 | 0.50 | 1.00 | How does VietMed contribute to Vietnamese speech recognition research? |
| q_190 | 0 | 0.00 | 0.80 | 1.00 | 0.50 | 1.00 | What type of algorithm does the agent use to decide on actions? |
| q_191 | 1 | 1.00 | 0.80 | 1.00 | 0.90 | 1.00 | How does local differential privacy affect the estimation process of a Gaussian  |
| q_192 | 1 | 1.00 | 0.20 | 1.00 | 0.50 | 1.00 | What is a reference strategy in order execution brokerage? |
| q_193 | 1 | 1.00 | 0.20 | 1.00 | 0.70 | 1.00 | What is the purpose of using a log link in count data models? |
| q_194 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | What is the purpose of the Density Peaks Clustering Algorithm? |
| q_195 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | What are some properties that define a semi-metric used in max-sum matchings? |
| q_196 | 1 | 0.33 | 0.60 | 1.00 | 0.50 | 1.00 | What is a single-hit dose-response model in the context of infection probability |
| q_197 | 1 | 0.33 | 0.40 | 1.00 | 1.00 | 1.00 | Can $\widehat{A}$ be an asymptotically OLPO without a strict $\sqrt{T}$-rate ass |
| q_198 | 1 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | How does backward scheduling work in a multi-stage production system? |
| q_199 | 1 | 0.50 | 0.20 | 1.00 | 1.00 | 1.00 | Does the asymptotic variance deteriorate as $\left\|\theta_{0}-\theta\right\|$ inc |
| q_200 | 1 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | Is the probability that the receiver chooses any not $\gamma$-approximately opti |