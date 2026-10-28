/* =========================================================
   课程知识点智能测评与学习诊断智能体 — 演示数据
   纯前端原型，所有数据均为模拟数据
   ========================================================= */
(function () {
  'use strict';

  const kpNames = [
    'Java概述', '变量与数据类型', '运算符', '流程控制', '数组', '方法',
    '面向对象基础', '继承', '多态', '接口', '异常处理', '集合框架',
    '泛型', 'IO流', '多线程', '网络编程', 'JDBC', 'Lambda表达式',
    'Stream API', '反射', '注解', 'JVM内存模型', '垃圾回收', '类加载机制',
    '设计模式', '单元测试', 'Maven构建', 'Spring入门'
  ];

  const kpDesc = [
    'Java语言特点、JDK/JRE/JVM基本关系', '变量声明、基本数据类型与类型转换',
    '算术、关系、逻辑运算符与优先级', 'if/switch、for/while与跳转语句',
    '数组声明、初始化、遍历与常见操作', '方法定义、参数传递、重载与递归',
    '类与对象、封装、构造方法', '继承关系、方法重写、super关键字',
    '多态机制、向上转型与动态绑定', '接口定义、实现与默认方法',
    '异常体系、try-catch-finally、自定义异常', 'List/Set/Map常用集合与遍历',
    '泛型类、泛型方法与类型擦除', '字节流、字符流与文件操作',
    '线程创建、同步与线程安全', 'Socket编程与HTTP基础',
    'JDBC连接、Statement与结果集处理', '函数式接口、方法引用与Lambda语法',
    'Stream中间操作与终端操作', 'Class对象、反射调用与动态代理',
    '内置注解、自定义注解与元注解', '堆栈、方法区与内存结构',
    'GC算法、分代回收与调优参数', '类加载过程、双亲委派模型',
    '单例、工厂、观察者等常见模式', 'JUnit断言、测试组织与覆盖率',
    '依赖管理、生命周期与常用插件', 'IoC、AOP与Spring Boot入门'
  ];

  // 0 = 小于 1 小时，便于演示“进行中”状态
  const SEED = 20260916;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(SEED);

  const now = new Date();
  const iso = d => d.toISOString();
  function at(dayOffset, h, m) {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m || 0, 0, 0);
    return d.toISOString();
  }
  function ago(minutes) {
    return iso(new Date(now.getTime() - minutes * 60000));
  }

  const students = [
    ['20260001', '袁仕郡'], ['20260002', '李思远'], ['20260003', '王雨桐'], ['20260004', '刘子涵'],
    ['20260005', '陈奕辰'], ['20260006', '杨欣怡'], ['20260007', '赵浩然'], ['20260008', '黄诗琪'],
    ['20260009', '周俊杰'], ['20260010', '吴梦瑶'], ['20260011', '徐子豪'], ['20260012', '孙可欣'],
    ['20260013', '马嘉懿'], ['20260014', '朱晨曦'], ['20260015', '胡博文'], ['20260016', '郭静怡'],
    ['20260017', '何宇航'], ['20260018', '高梦洁'], ['20260019', '林之涵'], ['20260020', '罗一鸣'],
    ['20260021', '梁若曦'], ['20260022', '宋佳明'], ['20260023', '唐可盈'], ['20260024', '许泽宇'],
    ['20260025', '邓雅文'], ['20260026', '冯天佑'], ['20260027', '曹思彤'], ['20260028', '彭子墨'],
    ['20260029', '董欣妍'], ['20260030', '袁浩宇'], ['20260031', '潘诗语'], ['20260032', '蒋一凡'],
    ['20260033', '蔡雨轩'], ['20260034', '余梦琪'], ['20260035', '杜明轩'], ['20260036', '叶嘉怡'],
    ['20260037', '程子涵'], ['20260038', '苏婉清'], ['20260039', '魏承宇'], ['20260040', '卢芷晴']
  ].map(([no, name], i) => ({
    id: 's' + (i + 1), no, name, classId: 'c1',
    major: '软件工程', adminClass: '软件24201', status: 'active'
  }));

  /* ---------------- 题库 ---------------- */
  const questions = [];
  let qSeq = 0;
  function addQ(kpId, type, stem, options, answer, analysis, difficulty, real) {
    qSeq += 1;
    questions.push({
      id: 'Q' + String(qSeq).padStart(4, '0'),
      kpId, type, stem, options, answer, analysis,
      difficulty: difficulty || '中', status: 'enabled', real: !!real
    });
  }

  const opt = (arr) => arr.map((t, i) => ({ key: 'ABCDEF'[i], text: t }));
  const judgeOpt = () => [{ key: 'T', text: '正确' }, { key: 'F', text: '错误' }];
  // 选择题选项做确定性轮换，避免答案集中在 A，同时保留原始正确答案映射
  function rotateOpts(type, stem, options, answer, salt) {
    if (type === 'judge' || options.length < 2) return { options: options, answer: answer };
    const n = options.length;
    const shift = (salt * 5 + stem.charCodeAt(0)) % n;
    const rotated = options.slice(shift).concat(options.slice(0, shift));
    const newOptions = rotated.map(function (o, i) { return { key: 'ABCDEF'[i], text: o.text }; });
    const map = {};
    options.forEach(function (o, i) { map[o.key] = 'ABCDEF'[(i - shift + n) % n]; });
    const newAnswer = answer.split('').map(function (k) { return map[k]; }).sort().join('');
    return { options: newOptions, answer: newAnswer };
  }

  const realBank = {
    kp01: [
      ['single', 'Java 应用程序的入口方法是？', ['main', 'start', 'run', 'init'], 'A', 'Java 应用程序通常从 main 方法开始执行。', '易'],
      ['single', '下列关于 JDK、JRE、JVM 关系的描述，正确的是？', ['JDK 包含 JRE，JRE 包含 JVM', 'JRE 包含 JDK，JDK 包含 JVM', 'JVM 包含 JDK，JDK 包含 JRE', '三者相互独立，没有包含关系'], 'A', 'JDK 提供开发工具，内含 JRE；JRE 提供运行环境，内含 JVM。', '中'],
      ['judge', 'JVM 负责执行 Java 字节码。', ['正确', '错误'], 'T', 'JVM 负责加载并执行编译后的字节码。', '易'],
      ['multi', 'Java 语言的特点包括？', ['面向对象', '跨平台', '支持自动垃圾回收', '必须手动管理内存'], 'ABC', 'Java 通过 JVM 实现跨平台，并提供 GC 自动管理内存。', '易']
    ],
    kp02: [
      ['single', '下列属于 Java 基本数据类型的是？', ['int', 'String', 'Integer', 'ArrayList'], 'A', 'int 是基本数据类型，其余均为引用类型。', '易'],
      ['multi', '关于 Java 变量命名，下列说法正确的有？', ['可以包含字母、数字、下划线和 $', '不能以数字开头', '可以使用关键字作为变量名', '区分大小写'], 'ABD', '变量名不能使用关键字，其余描述正确。', '中'],
      ['judge', '局部变量在使用前必须初始化。', ['正确', '错误'], 'T', 'Java 要求局部变量在使用前显式初始化。', '易'],
      ['single', 'int 类型在 Java 中占用的字节数是？', ['4 字节', '2 字节', '8 字节', '取决于操作系统'], 'A', 'Java 中 int 固定为 4 字节，与平台无关。', '中']
    ],
    kp03: [
      ['single', '表达式 5 / 2 的运算结果是？', ['2', '2.5', '3', '编译错误'], 'A', '两个 int 相除执行整数除法，结果为 2。', '易'],
      ['multi', '关于 == 与 equals，下列说法正确的有？', ['== 可以比较基本类型的值', '== 比较引用是否指向同一对象', 'equals 默认比较引用', 'String 重写了 equals 用于比较内容'], 'ABCD', '四项描述均正确，String 对 equals 进行了重写。', '中'],
      ['judge', '逻辑运算符 && 具有短路特性。', ['正确', '错误'], 'T', '当左侧为 false 时，&& 不会继续计算右侧表达式。', '易']
    ],
    kp04: [
      ['single', '下列不属于 Java 循环结构的是？', ['for', 'while', 'do-while', 'switch'], 'D', 'switch 是分支结构，不是循环结构。', '易'],
      ['multi', 'switch 语句支持的表达式类型包括？', ['byte', 'char', 'String', 'boolean'], 'ABC', 'switch 不支持 boolean 类型。', '中'],
      ['judge', 'break 可以用于跳出当前循环或 switch 语句。', ['正确', '错误'], 'T', 'break 用于终止当前所在的循环或 switch。', '易']
    ],
    kp05: [
      ['single', '获取数组长度使用的属性是？', ['length', 'size()', 'length()', 'count'], 'A', 'Java 数组通过 length 属性获取长度。', '易'],
      ['judge', 'Java 数组的下标从 0 开始。', ['正确', '错误'], 'T', '数组下标范围为 0 到 length-1。', '易'],
      ['multi', '关于 Java 数组，下列说法正确的有？', ['长度在创建后固定', '可以存储基本类型', '可以存储引用类型', '下标越界会抛出异常'], 'ABCD', '数组是定长容器，四种说法均正确。', '中']
    ],
    kp06: [
      ['single', '下列哪组方法构成合法的方法重载？', ['方法名相同、参数列表不同', '方法名不同、参数列表相同', '仅返回值类型不同', '仅访问修饰符不同'], 'A', '重载要求方法名相同、参数列表不同。', '中'],
      ['judge', '方法重载要求方法名相同且参数列表不同。', ['正确', '错误'], 'T', '仅返回值不同不构成重载。', '易']
    ],
    kp07: [
      ['multi', '构造方法的特点包括？', ['方法名与类名相同', '没有返回值类型', '可以被重载', '可以被继承'], 'ABC', '构造方法不能被继承。', '中'],
      ['single', '在 Java 中，用于创建对象的关键字是？', ['new', 'this', 'super', 'static'], 'A', 'new 用于在堆中创建对象并调用构造方法。', '易'],
      ['judge', '构造方法会在创建对象时被调用。', ['正确', '错误'], 'T', '创建对象时由 new 触发对应构造方法。', '易']
    ],
    kp08: [
      ['judge', 'Java 类支持多重继承。', ['正确', '错误'], 'F', 'Java 类只支持单继承，接口可以多实现。', '易'],
      ['single', '子类通过哪个关键字继承父类？', ['extends', 'implements', 'super', 'this'], 'A', '类继承使用 extends 关键字。', '易'],
      ['multi', '关于继承，下列说法正确的有？', ['子类可以复用父类的成员', '子类可以重写父类方法', 'Java 类只能单继承', '构造方法可以被继承'], 'ABC', '构造方法不能被继承。', '中']
    ],
    kp09: [
      ['single', '父类引用指向子类对象，体现了面向对象的哪个特性？', ['封装', '继承', '多态', '抽象'], 'C', '父类引用指向子类对象是运行时多态的典型表现。', '易'],
      ['multi', '实现多态的必要条件包括？', ['继承或实现接口', '方法重写', '父类引用指向子类对象', '方法必须为 static'], 'ABC', 'static 方法属于类，不参与运行时多态。', '中'],
      ['judge', '多态在运行期根据对象的实际类型决定调用哪个重写方法。', ['正确', '错误'], 'T', '这是动态绑定的核心机制。', '中']
    ],
    kp10: [
      ['judge', '接口中的抽象方法默认是 public abstract。', ['正确', '错误'], 'T', '接口方法默认隐式 public abstract。', '易'],
      ['single', '类实现接口使用的关键字是？', ['extends', 'implements', 'interface', 'abstract'], 'B', '类通过 implements 实现接口。', '易'],
      ['multi', '关于接口，下列说法正确的有？', ['接口可以包含常量', '接口可以被类实现', '一个类可以实现多个接口', '接口可以直接实例化'], 'ABC', '接口不能直接实例化。', '中']
    ],
    kp11: [
      ['single', '捕获异常使用的关键字是？', ['try', 'catch', 'finally', 'throw'], 'B', 'catch 用于捕获并处理异常。', '易'],
      ['judge', 'finally 代码块通常无论是否发生异常都会执行。', ['正确', '错误'], 'T', 'finally 常用于释放资源，一般都会执行。', '易']
    ],
    kp12: [
      ['single', '下列属于 List 接口实现类的是？', ['ArrayList', 'HashMap', 'HashSet', 'TreeMap'], 'A', 'ArrayList 是 List 的常用实现类。', '易'],
      ['judge', 'ArrayList 的底层通常基于动态数组实现。', ['正确', '错误'], 'T', 'ArrayList 内部使用可变数组存储元素。', '易']
    ]
  };

  const KPS = kpNames.map((name, i) => ({
    id: 'kp' + String(i + 1).padStart(2, '0'),
    courseId: 'c1',
    code: 'KP' + String(i + 1).padStart(2, '0'),
    name,
    desc: kpDesc[i],
    sort: i + 1,
    status: 'enabled'
  }));

  const kpMap = {};
  KPS.forEach(k => { kpMap[k.id] = k; });

  KPS.forEach(kp => {
    const reals = realBank[kp.id] || [];
    reals.forEach(([type, stem, opts, answer, analysis, diff]) => {
      const options = type === 'judge' ? judgeOpt() : opt(opts);
      const rotated = rotateOpts(type, stem, options, answer, qSeq + 1);
      addQ(kp.id, type, stem, rotated.options, rotated.answer, analysis, diff, true);
    });
    ['single', 'multi', 'judge'].forEach(type => {
      let count = questions.filter(q => q.kpId === kp.id && q.type === type).length;
      let idx = 0;
      while (count < 4) {
        idx += 1;
        if (type === 'single') {
          const stems = [
            `关于「${kp.name}」，下列说法正确的是？`,
            `在 Java 课程中，下列对「${kp.name}」的描述正确的是？`,
            `学习「${kp.name}」时，下列理解正确的是？`
          ];
          const optionSets = [
            ['属于本课程要求掌握的内容', '与本课程内容无关', '只能在考试中使用', '无需理解即可掌握'],
            ['需要结合概念理解与练习巩固', '只需要背诵名词即可', '与其它知识点没有任何联系', '掌握一次后不需要复习'],
            ['是后续相关内容的基础', '仅用于课堂讨论', '不属于教学大纲范围', '只能通过死记硬背掌握']
          ];
          const stem = stems[(idx - 1) % 3];
          const rotated = rotateOpts(type, stem, opt(optionSets[(idx - 1) % 3]), 'A', qSeq + 1);
          addQ(kp.id, type, stem, rotated.options, rotated.answer,
            `「${kp.name}」是本课程的核心知识点之一，应理解概念并结合练习掌握。`, idx % 2 ? '易' : '中', false);
        } else if (type === 'multi') {
          const stems = [`关于「${kp.name}」，下列说法正确的有？`, `学习「${kp.name}」时，下列做法合理的有？`];
          const stem = stems[(idx - 1) % 2];
          const rotated = rotateOpts(type, stem,
            opt(['属于本课程知识点', '需要结合练习巩固', '与其它知识点完全无关', '掌握后无需复习']), 'AB', qSeq + 1);
          addQ(kp.id, type, stem, rotated.options, rotated.answer,
            `「${kp.name}」需要理解核心概念并通过练习巩固，不是孤立的知识点。`, '中', false);
        } else {
          const stems = [
            `「${kp.name}」是本课程要求掌握的知识点之一。`,
            `「${kp.name}」只涉及理论记忆，不需要动手实践。`
          ];
          addQ(kp.id, type, stems[(idx - 1) % 2], judgeOpt(),
            (idx - 1) % 2 === 0 ? 'T' : 'F',
            (idx - 1) % 2 === 0 ? '该知识点属于课程大纲要求掌握的内容。' : '多数知识点需要结合实践练习，不能只靠记忆。',
            '易', false);
        }
        count += 1;
      }
    });
  });

  const qMap = {};
  questions.forEach(q => { qMap[q.id] = q; });

  /* ---------------- 组卷辅助 ---------------- */
  function pickQ(kpId, type, used) {
    const list = questions
      .filter(q => q.kpId === kpId && q.type === type && !used.has(q.id))
      .sort((a, b) => (b.real ? 1 : 0) - (a.real ? 1 : 0));
    if (!list.length) return null;
    const q = list[0];
    used.add(q.id);
    return q;
  }
  function buildItems(spec) {
    const used = new Set();
    const items = [];
    spec.forEach(([kpId, type, n, score]) => {
      for (let i = 0; i < n; i++) {
        const q = pickQ(kpId, type, used);
        if (q) items.push({ qid: q.id, score });
      }
    });
    return items;
  }

  const p1Items = buildItems([
    ['kp01', 'single', 1, 10], ['kp02', 'single', 1, 10], ['kp03', 'single', 1, 10], ['kp05', 'single', 1, 10],
    ['kp02', 'multi', 1, 10], ['kp03', 'multi', 1, 10], ['kp07', 'multi', 1, 10],
    ['kp01', 'judge', 1, 10], ['kp04', 'judge', 1, 10], ['kp08', 'judge', 1, 10]
  ]);
  const p2Items = buildItems([
    ['kp01', 'single', 1, 5], ['kp02', 'single', 1, 5], ['kp03', 'single', 1, 5], ['kp04', 'single', 1, 5],
    ['kp05', 'single', 1, 5], ['kp06', 'single', 1, 5], ['kp07', 'single', 1, 5], ['kp08', 'single', 1, 5],
    ['kp01', 'multi', 1, 5], ['kp02', 'multi', 1, 5], ['kp03', 'multi', 1, 5], ['kp05', 'multi', 1, 5],
    ['kp07', 'multi', 1, 5], ['kp09', 'multi', 1, 5],
    ['kp01', 'judge', 1, 5], ['kp02', 'judge', 1, 5], ['kp03', 'judge', 1, 5], ['kp04', 'judge', 1, 5],
    ['kp05', 'judge', 1, 5], ['kp06', 'judge', 1, 5]
  ]);
  const p6Items = buildItems([
    ['kp01', 'single', 1, 10], ['kp02', 'single', 1, 10], ['kp03', 'single', 1, 10], ['kp04', 'single', 1, 10],
    ['kp02', 'multi', 1, 10], ['kp03', 'multi', 1, 10], ['kp05', 'multi', 1, 10],
    ['kp01', 'judge', 1, 10], ['kp02', 'judge', 1, 10], ['kp04', 'judge', 1, 10]
  ]);
  const p4Items = buildItems([
    ['kp07', 'single', 1, 5], ['kp08', 'single', 1, 5], ['kp09', 'single', 1, 5], ['kp10', 'single', 1, 5],
    ['kp07', 'multi', 1, 5], ['kp08', 'multi', 1, 5], ['kp09', 'multi', 1, 5], ['kp10', 'multi', 1, 5],
    ['kp07', 'judge', 1, 5], ['kp08', 'judge', 1, 5], ['kp09', 'judge', 1, 5], ['kp10', 'judge', 1, 5]
  ]);
  const p3Items = buildItems([
    ['kp11', 'single', 1, 5], ['kp12', 'single', 1, 5], ['kp13', 'single', 1, 5],
    ['kp11', 'multi', 1, 5], ['kp12', 'multi', 1, 5],
    ['kp11', 'judge', 1, 5], ['kp12', 'judge', 1, 5], ['kp13', 'judge', 1, 5]
  ]);

  /* ---------------- 试卷 ---------------- */
  const papers = [
    {
      id: 'p1', name: '第3周知识点测验', courseId: 'c1', teacherId: 't1', teacherName: '赵璘',
      classIds: ['c1'], className: '软件24201', items: p1Items,
      status: 'published', startAt: at(0, 0, 0), endAt: at(1, 0, 0),
      duration: 30, attemptsAllowed: 1, answerPolicy: 'afterSubmit', shuffle: true,
      publishedAt: ago(180)
    },
    {
      id: 'p2', name: 'Java基础阶段测验', courseId: 'c1', teacherId: 't1', teacherName: '赵璘',
      classIds: ['c1'], className: '软件24201', items: p2Items,
      status: 'published', startAt: at(-7, 14, 0), endAt: at(-7, 15, 0),
      duration: 45, attemptsAllowed: 1, answerPolicy: 'afterEnd', shuffle: true,
      publishedAt: iso(new Date(now.getTime() - 8 * 86400000))
    },
    {
      id: 'p3', name: '第5周知识点测验', courseId: 'c1', teacherId: 't2', teacherName: '李娜',
      classIds: ['c2'], className: '软件24202', items: p3Items,
      status: 'draft', startAt: at(2, 9, 0), endAt: at(2, 10, 0),
      duration: 30, attemptsAllowed: 1, answerPolicy: 'afterSubmit', shuffle: true,
      publishedAt: null
    },
    {
      id: 'p4', name: '面向对象专题测验', courseId: 'c1', teacherId: 't1', teacherName: '赵璘',
      classIds: ['c1'], className: '软件24201', items: p4Items,
      status: 'published', startAt: at(1, 9, 0), endAt: at(1, 9, 30),
      duration: 30, attemptsAllowed: 1, answerPolicy: 'afterSubmit', shuffle: false,
      publishedAt: ago(60)
    },
    {
      id: 'p5', name: '课程综合测评（一）', courseId: 'c1', teacherId: 't3', teacherName: '王强',
      classIds: ['c3'], className: '计算机24201', items: p2Items,
      status: 'archived', startAt: at(-20, 9, 0), endAt: at(-20, 10, 0),
      duration: 45, attemptsAllowed: 1, answerPolicy: 'afterEnd', shuffle: true,
      publishedAt: iso(new Date(now.getTime() - 21 * 86400000))
    },
    {
      id: 'p6', name: '第1周知识点测验', courseId: 'c1', teacherId: 't1', teacherName: '赵璘',
      classIds: ['c1'], className: '软件24201', items: p6Items,
      status: 'published', startAt: at(-14, 9, 0), endAt: at(-14, 9, 30),
      duration: 30, attemptsAllowed: 1, answerPolicy: 'afterEnd', shuffle: true,
      publishedAt: iso(new Date(now.getTime() - 15 * 86400000))
    }
  ];

  /* ---------------- 作答记录 ---------------- */
  function wrongAnswer(q) {
    if (q.type === 'judge') return q.answer === 'T' ? 'F' : 'T';
    if (q.type === 'multi') return q.answer === 'A' ? 'B' : 'A';
    const keys = q.options.map(o => o.key);
    return keys.find(k => k !== q.answer) || 'B';
  }
  function makeAttempt(id, paper, studentId, correctCount, minutesAgo) {
    const answers = {};
    let score = 0, total = 0, correct = 0;
    paper.items.forEach((it, i) => {
      const q = qMap[it.qid];
      total += it.score;
      if (i < correctCount) {
        answers[q.id] = q.answer;
        score += it.score;
        correct += 1;
      } else {
        answers[q.id] = wrongAnswer(q);
      }
    });
    return {
      id, paperId: paper.id, studentId, answers, score, total, correctCount: correct,
      submittedAt: minutesAgo ? ago(minutesAgo) : iso(new Date(now.getTime() - 30 * 60000)),
      timeUsed: Math.round(paper.duration * 0.6)
    };
  }

  const attempts = [
    makeAttempt('a1', papers[5], 's1', 8, 14 * 1440),
    makeAttempt('a2', papers[1], 's1', 17, 7 * 1440)
  ];

  /* ---------------- 其他数据 ---------------- */
  const courses = [
    { id: 'c1', name: 'Java程序设计', code: 'CS-JAVA-01', term: '2026-2027 学年第一学期', owner: '赵璘', classes: 3, status: 'active', createdAt: '2026-08-28' },
    { id: 'c2', name: '数据结构与算法', code: 'CS-DSA-02', term: '2026-2027 学年第一学期', owner: '赵璘', classes: 2, status: 'active', createdAt: '2026-09-02' }
  ];

  const teachers = [
    { id: 't1', no: 'T0001', name: '赵璘', courseId: 'c1', classes: '软件24201', phone: '138****2210', status: 'active' },
    { id: 't2', no: 'T0002', name: '李娜', courseId: 'c1', classes: '软件24202', phone: '139****8832', status: 'active' },
    { id: 't3', no: 'T0003', name: '王强', courseId: 'c1', classes: '计算机24201', phone: '137****1045', status: 'active' }
  ];

  const classes = [
    { id: 'c1', name: '软件24201', courseId: 'c1', teacherId: 't1', teacherName: '赵璘', count: 40, major: '软件工程', term: '2026-2027-1' },
    { id: 'c2', name: '软件24202', courseId: 'c1', teacherId: 't2', teacherName: '李娜', count: 38, major: '软件工程', term: '2026-2027-1' },
    { id: 'c3', name: '计算机24201', courseId: 'c1', teacherId: 't3', teacherName: '王强', count: 42, major: '计算机科学与技术', term: '2026-2027-1' }
  ];

  const p1Scores = students.map((s, i) => {
    // 演示账号袁仕郡保留为“未提交”，方便完整走一遍学生答题流程
    if (i === 0 || i >= 38) return null;
    return 60 + Math.round(rnd() * 4) * 10;
  });
  const submitted = p1Scores.filter(v => v !== null);
  const p1Avg = Math.round(submitted.reduce((a, b) => a + b, 0) / submitted.length * 10) / 10;

  const kpAvg = KPS.slice(0, 10).map((k, i) => {
    const base = [88, 82, 76, 71, 79, 73, 68, 62, 66, 84][i];
    return { kpId: k.id, code: k.code, name: k.name, avg: base + Math.round(rnd() * 6 - 3), count: 4 };
  });
  const qAccuracy = papers[0].items.map((it, i) => ({
    qid: it.qid,
    accuracy: [92, 85, 78, 73, 66, 58, 74, 88, 63, 81][i] + Math.round(rnd() * 6 - 3)
  }));

  const classSummaries = [
    { classId: 'c1', className: '软件24201', teacher: '赵璘', expected: 40, completed: submitted.length, avg: p1Avg, max: Math.max(...submitted), min: Math.min(...submitted) },
    { classId: 'c2', className: '软件24202', teacher: '李娜', expected: 38, completed: 33, avg: 74.6, max: 96, min: 48 },
    { classId: 'c3', className: '计算机24201', teacher: '王强', expected: 42, completed: 39, avg: 81.2, max: 98, min: 55 }
  ];

  const logs = [
    { id: 'L001', operator: '赵璘', role: '课程负责人', action: '导入', detail: '导入知识点 28 条（成功 28，失败 0）', time: ago(60 * 24 * 3) },
    { id: 'L002', operator: '赵璘', role: '课程负责人', action: '题库', detail: '导入题库 120 条（成功 118，警告 2）', time: ago(60 * 24 * 2) },
    { id: 'L003', operator: '赵璘', role: '教师', action: '组卷', detail: '发布试卷「第3周知识点测验」至软件24201', time: ago(180) },
    { id: 'L004', operator: '李娜', role: '教师', action: '导入', detail: '导入学生 38 条至软件24202', time: ago(60 * 26) },
    { id: 'L005', operator: '赵璘', role: '教师', action: '导出', detail: '导出「Java基础阶段测验」学生成绩明细', time: ago(60 * 20) },
    { id: 'L006', operator: '赵璘', role: '课程负责人', action: '账号', detail: '重置教师「王强」登录密码', time: ago(60 * 8) },
    { id: 'L007', operator: '赵璘', role: '课程负责人', action: '导出', detail: '导出课程级知识点统计报表', time: ago(95) }
  ];

  window.DB = {
    version: 1,
    courses,
    kps: KPS,
    questions,
    papers,
    attempts,
    teachers,
    classes,
    students,
    logs,
    p1Scores,
    kpAvg,
    qAccuracy,
    classSummaries,
    seededAt: now.toISOString()
  };
})();
